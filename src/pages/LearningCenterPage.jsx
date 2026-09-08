import { useEffect, useMemo, useState } from "react";
import {
  buildExamReadiness,
  buildRepeatedWrong,
  buildTodayStudyPlan,
  buildWeakConcepts,
  dDayAnalysis,
} from "../utils/learningEngine";
import { consolidateQuestionTopics } from "../utils/topicClassifier.js";

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
    if (!loadQuestions || !exams.length) {
      setQuestionCatalog([]);
      return undefined;
    }
    Promise.all(exams.map(async (exam) => {
      const questions = await loadQuestions(exam.id).catch(() => []);
      return questions.map((question) => ({ ...question, sourceExamId: question.sourceExamId || exam.id }));
    })).then((groups) => { if (alive) setQuestionCatalog(groups.flat()); });
    return () => { alive = false; };
  }, [exams, loadQuestions]);

  const consolidated = useMemo(() => consolidateQuestionTopics(questionCatalog, { minTopicSize: 2 }), [questionCatalog]);
  const topicByQuestionId = useMemo(() => {
    const map = new Map();
    consolidated.questions.forEach((question) => {
      const id = String(question.id || question.questionId || "");
      if (id) map.set(id, question.topic);
    });
    return map;
  }, [consolidated.questions]);
  const weakConcepts = useMemo(() => buildWeakConcepts(learningProgress, 4, { topicByQuestionId }), [learningProgress, topicByQuestionId]);
  const repeatedWrong = useMemo(() => buildRepeatedWrong(learningProgress), [learningProgress]);
  const readiness = useMemo(
    () => buildExamReadiness({ progress: learningProgress, history, exams, questionCatalog, plan, passScore: Number(certificate?.passScore || 60) }),
    [certificate?.passScore, exams, history, learningProgress, plan, questionCatalog],
  );
  const today = useMemo(
    () => buildTodayStudyPlan({ progress: learningProgress, wrongNotes, practiceHistory, plan, pdfLibrary, readiness, topicByQuestionId }),
    [learningProgress, pdfLibrary, plan, practiceHistory, readiness, topicByQuestionId, wrongNotes],
  );
  const dday = useMemo(() => dDayAnalysis(plan, readiness), [plan, readiness]);
  const top = weakConcepts[0]?.tag || "전체 과목";
  const recommendedCount = Math.max(10, Math.min(40, Number(readiness.recommendedDailyQuestions || today.dailyGoal || 15)));

  function startTask(task) {
    if (task.id === "srs") onStartDueReview?.(today.due);
    else if (task.id === "repeated") onStartRepeatedWrong?.(repeatedWrong);
    else if (task.id === "weak") onStartRecommended?.(top, Math.max(10, Number(task.count || recommendedCount)));
    else if (task.id === "pdf") onNavigate?.("library");
  }

  return <main className="page-shell simple-ai-learning">
    <section className="simple-learning-head">
      <div><span className="eyebrow">AI 추천 학습</span><h1>지금 필요한 공부</h1></div>
      <button className="primary" onClick={() => onStartRecommended?.(top, recommendedCount)}>바로 시작</button>
    </section>

    <section className="panel simple-ai-focus">
      <div><span>{certificate?.name}</span><h2>{top} 중심 {recommendedCount}문제</h2><p>오답과 최근 풀이를 반영한 추천입니다.</p></div>
      <button className="primary" onClick={() => onStartRecommended?.(top, recommendedCount)}>AI 추천 문제 시작</button>
    </section>

    <section className="panel simple-today-tasks">
      <div className="simple-section-head"><h2>오늘 할 공부</h2><span>{dday.dday == null ? "시험일 미설정" : dday.dday >= 0 ? `D-${dday.dday}` : "시험일 지남"}</span></div>
      <div>
        {today.tasks.filter((task) => task.enabled).slice(0, 4).map((task) => <button key={task.id} onClick={() => startTask(task)}>
          <span><strong>{task.title}</strong><small>{task.count}문제</small></span><b>시작</b>
        </button>)}
        {!today.tasks.some((task) => task.enabled) && <p>추천 학습을 시작하면 다음 복습도 자동으로 정리됩니다.</p>}
      </div>
    </section>

    <section className="simple-learning-bottom">
      <article className="panel simple-readiness-card">
        <div className="simple-section-head"><h2>시험 준비</h2><button onClick={() => onNavigate?.("planner")}>시험일 설정</button></div>
        <strong>{readiness.readinessScore}%</strong>
        <span>{readiness.stage}</span>
        <div><i style={{ width: `${Math.max(0, Math.min(100, readiness.readinessScore))}%` }}/></div>
        <p>오늘 {recommendedCount}문제를 풀면 됩니다.</p>
      </article>

      <article className="panel simple-weak-card">
        <div className="simple-section-head"><h2>먼저 볼 개념</h2><button onClick={() => onNavigate?.("topic")}>주제별 보기</button></div>
        <div>{weakConcepts.map((item) => <button key={item.tag} onClick={() => onStartRecommended?.(item.tag, 10)}><span><strong>{item.tag}</strong><small>정답률 {item.accuracy}%</small></span><b>10문제</b></button>)}</div>
        {!weakConcepts.length && <p>문제를 풀면 취약 개념을 자동으로 찾습니다.</p>}
      </article>
    </section>
  </main>;
}
