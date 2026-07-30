import { useEffect, useMemo, useState } from "react";
import {
  buildExamReadiness,
  buildRepeatedWrong,
  buildTodayStudyPlan,
  buildWeakConcepts,
  dDayAnalysis,
  difficultySummary,
  estimatePassProjection,
} from "../utils/learningEngine";
import { requestLearningCoach } from "../utils/learningApi";
import { consolidateQuestionTopics } from "../utils/topicClassifier.js";

function localGuide({ weakConcepts, projection, readiness, today, frequentTopics }) {
  const top = weakConcepts[0]?.tag || "전체 과목";
  return {
    headline: weakConcepts.length ? `${top}의 이해도를 먼저 안정시키는 것이 좋습니다.` : "첫 학습 기록을 만들어 보세요.",
    summary: weakConcepts.length
      ? `자동 복습 ${today.due.length}문제와 반복 오답 ${today.repeated.length}문제를 먼저 처리한 뒤 ${top} 문제를 풀어 보세요.`
      : "문제를 풀고 자기평가를 남기면 복습 일정과 취약 개념을 바로 확인할 수 있어요.",
    highScoreGuide: [
      { title: "복습 예정일 우선", detail: "오래 미룬 문제부터 해결해 기억 간격을 다시 맞춥니다.", action: "자동 복습 시작" },
      { title: "반복 오답 원인 확인", detail: "같은 문제를 다시 맞히는 것보다 틀린 선택지의 이유를 설명하는 연습이 중요합니다.", action: "반복 오답 풀기" },
      { title: "취약 개념 집중", detail: `${top} 관련 문제를 짧게 반복하고 자기평가가 '확실함'이 될 때까지 복습합니다.`, action: "취약 문제 시작" },
    ],
    predictedTopics: (weakConcepts.length ? weakConcepts.slice(0, 5) : frequentTopics.slice(0, 5)).map((item, index) => {
      const frequency = frequentTopics.find((row) => row.topic === (item.tag || item.topic))?.count || 0;
      return {
        topic: item.tag || item.topic,
        reason: item.tag
          ? `숙련도 ${item.mastery}% · 오답 ${item.wrong}회${frequency ? ` · 관련 기출 ${frequency}문제` : ""}`
          : `관련 기출 ${item.count}문제`,
        priority: Math.min(5, index + 1),
      };
    }),
    dailyPlan: today.tasks.filter((task) => task.enabled).map((task) => ({ title: task.title, count: task.count, reason: task.detail })),
    caution: `준비도는 기출 학습 범위, 반복 복습, 문제 숙련도와 실전 성적을 종합한 참고 지표입니다.${projection.sampleSize ? ` 예상 점수는 최근 ${projection.sampleSize}회의 실전 기록을 반영했어요.` : " 실전 기록이 쌓이면 예상 점수도 함께 확인할 수 있어요."}`,
  };
}

export default function LearningCenterPage({
  certificate,
  history = [],
  practiceHistory = [],
  wrongNotes = [],
  learningProgress = [],
  plan = {},
  pdfLibrary = [],
  exams = [],
  loadQuestions,
  onStartRecommended,
  onStartDueReview,
  onStartRepeatedWrong,
  onNavigate,
}) {
  const [questionCatalog, setQuestionCatalog] = useState([]);
  useEffect(() => {
    let alive = true;
    if (!loadQuestions || !exams.length) { setQuestionCatalog([]); return undefined; }
    Promise.all(exams.map(async (exam) => {
      const questions = await loadQuestions(exam.id).catch(() => []);
      return questions.map((question) => ({
        ...question,
        sourceExamId: question.sourceExamId || exam.id,
        examYear: question.examYear || exam.year || "",
      }));
    }))
      .then((groups) => { if (alive) setQuestionCatalog(groups.flat()); });
    return () => { alive = false; };
  }, [exams, loadQuestions]);
  const consolidatedCatalog = useMemo(
    () => consolidateQuestionTopics(questionCatalog, { minTopicSize: 2 }),
    [questionCatalog],
  );

  const topicByQuestionId = useMemo(() => {
    const map = new Map();
    consolidatedCatalog.questions.forEach((question) => {
      const id = String(question.id || question.questionId || "");
      if (id) map.set(id, question.topic);
    });
    return map;
  }, [consolidatedCatalog.questions]);

  const frequentTopics = useMemo(() => {
    const map = new Map();
    for (const question of consolidatedCatalog.questions) {
      const topic = String(question.topic || "").trim();
      if (topic) map.set(topic, (map.get(topic) || 0) + 1);
    }
    return [...map.entries()]
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [consolidatedCatalog.questions]);

  const weakConcepts = useMemo(
    () => buildWeakConcepts(learningProgress, 8, { topicByQuestionId }),
    [learningProgress, topicByQuestionId],
  );
  const repeatedWrong = useMemo(() => buildRepeatedWrong(learningProgress), [learningProgress]);
  const projection = useMemo(
    () => estimatePassProjection(history, Number(certificate?.passScore || 60)),
    [certificate?.passScore, history],
  );
  const readiness = useMemo(
    () => buildExamReadiness({
      progress: learningProgress,
      history,
      exams,
      questionCatalog,
      plan,
      passScore: Number(certificate?.passScore || 60),
    }),
    [certificate?.passScore, exams, history, learningProgress, plan, questionCatalog],
  );
  const today = useMemo(
    () => buildTodayStudyPlan({
      progress: learningProgress,
      wrongNotes,
      practiceHistory,
      plan,
      pdfLibrary,
      readiness,
      topicByQuestionId,
    }),
    [learningProgress, pdfLibrary, plan, practiceHistory, readiness, topicByQuestionId, wrongNotes],
  );
  const dday = useMemo(() => dDayAnalysis(plan, readiness), [plan, readiness]);
  const difficulties = useMemo(() => difficultySummary(learningProgress), [learningProgress]);
  const fallbackGuide = useMemo(
    () => localGuide({ weakConcepts, projection, readiness, today, frequentTopics }),
    [frequentTopics, projection, readiness, today, weakConcepts],
  );
  const [guide, setGuide] = useState(null);
  const [guideBusy, setGuideBusy] = useState(false);
  const [guideMessage, setGuideMessage] = useState("");
  const visibleGuide = guide || fallbackGuide;
  const solved = history.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const top = weakConcepts[0]?.tag || "전체 과목";

  async function generateGuide() {
    setGuideBusy(true);
    setGuideMessage("");
    try {
      const result = await requestLearningCoach({
        certificateName: certificate?.name || "선택한 자격증",
        examProjection: projection,
        weakConcepts,
        frequentTopics,
        repeatedWrong: repeatedWrong.slice(0, 10).map((item) => ({
          subject: item.subject,
          topic: topicByQuestionId.get(String(item.questionId || item.id || "")) || item.topic,
          wrongCount: item.wrongCount,
          confidence: item.confidence,
        })),
        difficultySummary: difficulties,
        todayPlan: { tasks: today.tasks, dueCount: today.due.length, repeatedCount: today.repeated.length },
        dday,
        readiness,
      });
      setGuide({
        ...fallbackGuide,
        ...result,
        highScoreGuide: result.highScoreGuide?.length ? result.highScoreGuide : fallbackGuide.highScoreGuide,
        predictedTopics: result.predictedTopics?.length ? result.predictedTopics : fallbackGuide.predictedTopics,
        dailyPlan: result.dailyPlan?.length ? result.dailyPlan : fallbackGuide.dailyPlan,
      });
      setGuideMessage(`AI 학습 가이드를 새로 업데이트했어요.`);
    } catch (error) {
      setGuide(null);
      setGuideMessage(`${error.message} 기본 분석 결과를 표시합니다.`);
    } finally {
      setGuideBusy(false);
    }
  }

  return (
    <main className="page-shell learning-ops-page">
      <section className="page-title learning-ops-head">
        <div>
          <span className="eyebrow">AI LEARNING OPERATING SYSTEM</span>
          <h1>{certificate?.name} 학습 운영센터</h1>
          <p>오늘의 학습, 복습 일정, 취약 개념과 시험 준비도를 한곳에서 확인하세요.</p>
        </div>
        <button className="primary" onClick={generateGuide} disabled={guideBusy}>
          {guideBusy ? "AI 분석 중…" : "AI 고득점 가이드 갱신"}
        </button>
      </section>

      <section className="learning-kpi-grid learning-ops-kpi">
        <article><span>실전 누적 풀이</span><strong>{solved}문제</strong><small>실전 풀이 기준</small></article>
        <article><span>시험 준비도</span><strong>{readiness.readinessScore}%</strong><small>{readiness.stage} · 기출 {readiness.coveredSessions}/{readiness.recommendedExamSessions}회</small></article>
        <article><span>오늘 자동 복습</span><strong>{today.due.length}문제</strong><small>오늘 복습할 문제</small></article>
        <article><span>반복 오답</span><strong>{repeatedWrong.length}문제</strong><small>2회 이상 틀린 문제</small></article>
      </section>

      <section className="panel today-learning-queue">
        <div className="section-heading">
          <div><span className="eyebrow">TODAY</span><h2>오늘 해야 할 공부</h2></div>
          <span>{dday.dday === null ? "시험일 미설정" : dday.dday >= 0 ? `D-${dday.dday} · ${dday.status}` : dday.status}</span>
        </div>
        <div className="today-learning-grid">
          {today.tasks.map((task, index) => (
            <article key={task.id} className={!task.enabled ? "disabled" : ""}>
              <b>{index + 1}</b>
              <div>
                <strong>{task.title}</strong><span>{task.detail}</span>
                {task.reasons?.length > 0 && (
                  <details className="recommendation-reasons">
                    <summary>추천 이유 보기</summary>
                    <ul>{task.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                  </details>
                )}
              </div>
              <em>{task.count}개</em>
              {task.id === "srs" && <button onClick={() => onStartDueReview?.(today.due)} disabled={!task.enabled}>복습 시작</button>}
              {task.id === "repeated" && <button onClick={() => onStartRepeatedWrong?.(repeatedWrong)} disabled={!task.enabled}>집중 복습</button>}
              {task.id === "weak" && <button onClick={() => onStartRecommended?.(top, task.count)}>문제 시작</button>}
              {task.id === "pdf" && <button onClick={() => onNavigate?.("library")} disabled={!task.enabled}>PDF 열기</button>}
            </article>
          ))}
        </div>
      </section>

      <section className="learning-ops-grid">
        <article className="panel ai-highscore-card">
          <div className="v6-card-heading">
            <div><span className="eyebrow">AI HIGH-SCORE GUIDE</span><h2>{visibleGuide.headline}</h2></div>
            <span className="v6-status">개인 기록 기반</span>
          </div>
          <p>{visibleGuide.summary}</p>
          <div className="highscore-guide-list">
            {visibleGuide.highScoreGuide.map((item, index) => (
              <article key={`${item.title}-${index}`}>
                <span>{index + 1}</span>
                <div><strong>{item.title}</strong><p>{item.detail}</p><small>{item.action}</small></div>
              </article>
            ))}
          </div>
          {guideMessage && <p className="learning-guide-message">{guideMessage}</p>}
          <small className="learning-caution">{visibleGuide.caution}</small>
        </article>

        <article className="panel pass-projection-card">
          <span className="eyebrow">D-DAY & PASS PROJECTION</span>
          <h2>시험 준비도</h2>
          <div
            className="pass-ring"
            role="img"
            aria-label={`시험 준비도 ${readiness.readinessScore}%`}
          >
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle className="pass-ring-track" cx="60" cy="60" r="52" pathLength="100" />
              <circle
                className="pass-ring-progress"
                cx="60"
                cy="60"
                r="52"
                pathLength="100"
                strokeDasharray={`${Math.max(0, Math.min(100, readiness.readinessScore))} ${100 - Math.max(0, Math.min(100, readiness.readinessScore))}`}
              />
            </svg>
            <div className="pass-ring-content">
              <strong>{readiness.readinessScore}</strong>
              <span>% · {readiness.stage}</span>
            </div>
          </div>
          <dl>
            <div><dt>기출 학습 회차</dt><dd>{readiness.coveredSessions}/{readiness.recommendedExamSessions}회</dd></div>
            <div><dt>숙련 이상</dt><dd>{readiness.proficientOrBetterCount}/{readiness.targetQuestionCount}문제</dd></div>
            <div><dt>마스터 문제</dt><dd>{readiness.masteredQuestionCount}문제</dd></div>
            <div><dt>계획상 필요량</dt><dd>{dday.requiredDailyQuestions === null ? "계산 중" : `${dday.requiredDailyQuestions}문제/일`}</dd></div>
            <div><dt>실행 권장량</dt><dd>{today.dailyGoal}문제/일</dd></div>
          </dl>
          <div className="readiness-components">
            <strong>준비도 계산 근거</strong>
            {readiness.components?.map((item) => (
              <div key={item.id}>
                <span>{item.label}<small>{item.detail}</small></span>
                <b>{item.score}/{item.max}점</b>
                <i><em style={{ width: `${Math.min(100, item.percentage)}%` }} /></i>
              </div>
            ))}
          </div>
          <div className="mastery-stage-summary">
            <span>풀이 완료 <b>{readiness.masteryStageCounts?.answered || 0}</b></span>
            <span>이해 중 <b>{readiness.masteryStageCounts?.understanding || 0}</b></span>
            <span>숙련 <b>{readiness.masteryStageCounts?.proficient || 0}</b></span>
            <span>마스터 <b>{readiness.masteryStageCounts?.mastered || 0}</b></span>
          </div>
          <small className="learning-caution">최근 3~4개년도 기출을 충분히 학습하고 반복 복습하는 것을 목표로 계산해요. 최근 7일 학습량을 반영해 오늘 실천할 수 있는 문제 수를 추천합니다.{today.recommendationGap > 0 ? ` 계획상 필요량보다 ${today.recommendationGap}문제 가볍게 시작해 점차 늘려가요.` : ""}{readiness.catalogLimited ? ` 현재 확인 가능한 기출은 ${readiness.availableSessions}회예요.` : ""}</small>
          <button className="secondary wide" onClick={() => onNavigate?.("planner")}>D-Day 계획 조정</button>
        </article>
      </section>

      <section className="learning-ops-grid">
        <article className="panel weak-concept-card">
          <div className="section-heading"><div><span className="eyebrow">WEAK CONCEPTS</span><h2>취약 개념 분석</h2></div><button className="text-button" onClick={() => onNavigate?.("topic")}>주제별 학습</button></div>
          {weakConcepts.length ? weakConcepts.map((item) => (
            <div className="weak-concept-row" key={item.tag}>
              <div><strong>{item.tag}</strong><span>정답률 {item.accuracy}% · 오답 {item.wrong}회</span></div>
              <div className="weakness-bar"><i style={{ width: `${item.mastery}%` }} /></div>
              <b>{item.mastery}%</b>
            </div>
          )) : <p className="muted">문제를 풀고 자기평가를 남기면 취약 개념이 표시돼요.</p>}
        </article>

        <article className="panel prediction-card">
          <span className="eyebrow">PERSONAL PRIORITY PREDICTION</span>
          <h2>우선 대비 개념</h2>
          <p className="muted">내 오답과 숙련도를 바탕으로 지금 먼저 공부할 개념을 추천해요.</p>
          <div className="prediction-list">
            {visibleGuide.predictedTopics.length ? visibleGuide.predictedTopics.map((item) => (
              <div key={item.topic}><b>{item.priority}</b><span><strong>{item.topic}</strong><small>{item.reason}</small></span></div>
            )) : <p className="muted">학습 기록이 쌓이면 우선 대비 개념을 확인할 수 있어요.</p>}
          </div>
        </article>
      </section>

      <section className="panel difficulty-panel">
        <div className="section-heading"><div><span className="eyebrow">PERSONAL DIFFICULTY</span><h2>내 학습 기록으로 본 문제 난이도</h2></div><button className="text-button" onClick={() => onNavigate?.("report")}>성장 리포트</button></div>
        <div className="difficulty-summary-grid">
          <article><span>어려움</span><strong>{difficulties.hard}</strong><small>정답률 35% 이하 또는 연속 오답</small></article>
          <article><span>보통</span><strong>{difficulties.medium}</strong><small>정답률 36~70%</small></article>
          <article><span>쉬움</span><strong>{difficulties.easy}</strong><small>정답률 71% 이상</small></article>
          <article><span>분석 중</span><strong>{difficulties.pending}</strong><small>풀이 횟수 2회 미만</small></article>
        </div>
      </section>
    </main>
  );
}
