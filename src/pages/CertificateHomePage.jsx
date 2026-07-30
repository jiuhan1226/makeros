import { useEffect, useMemo, useState } from "react";
import StatCard from "../components/StatCard";
import { buildWrongNoteAnalysis } from "../utils/exam";
import { buildSubjectCatalog, buildSubjectProgress } from "../utils/cbtSubjects";
import { buildExamReadiness, buildTodayStudyPlan, buildWeakConcepts, estimatePassProjection, isTargetedPracticeRecord } from "../utils/learningEngine";

function dayKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function streakFrom(history) {
  const days = new Set(history.map((item) => dayKey(item.createdAt)).filter(Boolean));
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 365; i += 1) {
    const key = dayKey(cursor);
    if (!days.has(key)) {
      if (i === 0) { cursor.setDate(cursor.getDate() - 1); continue; }
      break;
    }
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function readReflection(certificateId) {
  try { return JSON.parse(localStorage.getItem(`studylock-reflection-${certificateId}`) || "null"); }
  catch { return null; }
}

export default function CertificateHomePage({ certificate, exams, history, practiceHistory = [], wrongNotes, learningProgress = [], plan, pdfLibrary = [], onNavigate, onOpenExam, loadQuestions }) {
  const latest = history[0];
  const analysis = buildWrongNoteAnalysis(wrongNotes, history);
  const [subjectCatalog, setSubjectCatalog] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!exams.length || !loadQuestions) {
      setSubjectCatalog([]);
      return undefined;
    }
    setSubjectsLoading(true);
    Promise.all(exams.map((exam) => loadQuestions(exam.id).catch(() => [])))
      .then((groups) => { if (alive) setSubjectCatalog(buildSubjectCatalog(groups)); })
      .finally(() => { if (alive) setSubjectsLoading(false); });
    return () => { alive = false; };
  }, [certificate?.id, exams, loadQuestions]);

  const targetedPracticeHistory = useMemo(() => practiceHistory.filter(isTargetedPracticeRecord), [practiceHistory]);
  const subjectRows = useMemo(() => buildSubjectProgress(subjectCatalog, targetedPracticeHistory), [subjectCatalog, targetedPracticeHistory]);
  const totalSolved = history.reduce((sum, item) => sum + (item.total || 0), 0);
  const average = history.length ? Math.round(history.reduce((sum, item) => sum + (item.score || 0), 0) / history.length) : 0;
  const weakConcepts = useMemo(() => buildWeakConcepts(learningProgress, 5), [learningProgress]);
  const weakSubject = weakConcepts[0]?.tag || analysis.weakSubjects[0]?.subject || subjectRows[0]?.subject || "전체 과목";
  const projection = useMemo(() => estimatePassProjection(history, Number(certificate?.passScore || 60)), [history, certificate?.passScore]);
  const readiness = useMemo(
    () => buildExamReadiness({ progress: learningProgress, history, exams, plan, passScore: Number(certificate?.passScore || 60) }),
    [certificate?.passScore, exams, history, learningProgress, plan],
  );
  const todayPlan = useMemo(() => buildTodayStudyPlan({ progress: learningProgress, wrongNotes, practiceHistory, plan, pdfLibrary, readiness }), [learningProgress, wrongNotes, practiceHistory, plan, pdfLibrary, readiness]);
  const reviewCount = todayPlan.due.length;
  const recommendedCount = readiness.recommendedDailyQuestions;
  const streak = streakFrom([...history, ...practiceHistory]);
  const [showReason, setShowReason] = useState(false);
  const [difficulty, setDifficulty] = useState("");
  const [hardConcept, setHardConcept] = useState("");
  const [reflection, setReflection] = useState(() => readReflection(certificate?.id));

  const coachReasons = useMemo(() => {
    if (!history.length) return ["아직 분석할 학습 기록이 없어요.", "첫 문제를 풀면 오답과 정답률을 바탕으로 다음 학습을 추천해요."];
    const wrong = analysis.weakSubjects[0]?.wrongCount || 0;
    const days = latest?.createdAt ? Math.max(0, Math.floor((Date.now() - latest.createdAt) / 86400000)) : 0;
    return [
      `${weakSubject}에서 ${wrong}개의 오답이 누적되었습니다.`,
      `최근 학습 이후 ${days}일이 지났습니다.`,
      reflection?.hardConcept ? `직전 학습 회고에서 '${reflection.hardConcept}' 개념을 어렵다고 기록했습니다.` : "학습 회고가 아직 없어 CBT 기록을 중심으로 추천했습니다.",
    ];
  }, [history, analysis.weakSubjects, weakSubject, latest?.createdAt, reflection]);

  function saveReflection() {
    if (!difficulty && !hardConcept.trim()) return;
    const next = { difficulty, hardConcept: hardConcept.trim(), createdAt: Date.now() };
    localStorage.setItem(`studylock-reflection-${certificate?.id}`, JSON.stringify(next));
    setReflection(next); setDifficulty(""); setHardConcept("");
  }

  return <main className="page-shell v6-dashboard">
    <section className="v6-welcome">
      <div><span className="eyebrow">TODAY'S LEARNING</span><h1>혼자 공부해도 길을 잃지 않도록</h1><p>{certificate?.name} 학습 기록을 분석해 오늘 가장 필요한 공부부터 안내합니다.</p></div>
      <button className="primary" onClick={() => onNavigate("learning")}>오늘의 학습 시작</button>
    </section>

    <section className="v6-today-grid">
      <article><span>복습할 개념</span><strong>{reviewCount}개</strong><p>지금 복습하면 좋은 문제</p><button onClick={() => onNavigate("bookmark")}>복습 목록 보기</button></article>
      <article><span>추천 문제</span><strong>{recommendedCount}문제</strong><p>{weakSubject} 중심 추천</p><button onClick={() => onNavigate("learning")}>추천 문제 보기</button></article>
      <article><span>시험 준비도</span><strong>{readiness.readinessScore}%</strong><p>{readiness.stage} · 기출 {readiness.coveredSessions}/{readiness.recommendedExamSessions}회</p><button onClick={() => onNavigate("learning")}>준비도 근거 보기</button></article>
      <article><span>연속 학습</span><strong>{streak}일</strong><p>{latest?.title || "첫 학습을 시작해 보세요"}</p><button onClick={() => onNavigate("stats")}>학습 기록 보기</button></article>
    </section>

    <section className="v6-primary-grid">
      <article className="panel v6-coach-card">
        <div className="v6-card-heading"><div><span className="eyebrow">AI LEARNING COACH</span><h2>{history.length ? `${weakSubject}부터 복습하는 것이 좋습니다.` : "첫 학습 기록을 만들어 보세요."}</h2></div><span className="v6-status">개인화 추천</span></div>
        <p>{history.length ? analysis.summary : "기출이나 과목별 학습을 시작하면 오답과 학습 간격을 살펴 다음 공부 순서를 추천해요."}</p>
        <div className="v6-path">
          {(analysis.weakSubjects.length ? analysis.weakSubjects.slice(0, 3).map((item) => item.subject) : ["기출문제 풀이", "오답 분석", "개인별 복습"]).map((item, index) => <div key={item}><span>{index + 1}</span><strong>{item}</strong></div>)}
        </div>
        <button className="v6-reason-toggle" onClick={() => setShowReason((v) => !v)}>{showReason ? "추천 이유 닫기" : "추천 이유 보기"}</button>
        {showReason && <div className="v6-reason-box">{coachReasons.map((reason) => <p key={reason}>{reason}</p>)}</div>}
        <div className="coach-action-row"><button className="primary" onClick={() => onNavigate("learning")}>추천 학습 시작</button><button className="secondary" onClick={() => onNavigate("subject")}>과목별 CBT 보기</button></div>
      </article>

      <article className="panel v6-summary-card">
        <span className="eyebrow">LEARNING DATA</span><h2>현재 학습 상태</h2>
        <div className="compact-stats"><StatCard label="실전 누적 풀이" value={`${totalSolved}문제`} /><StatCard label="실전 평균 정답률" value={`${average}%`} /></div>
        <div className="summary-list"><div><span>오늘 자동 복습</span><strong>{todayPlan.due.length}문제</strong></div><div><span>가장 취약한 개념</span><strong>{weakSubject}</strong></div><div><span>기출 회차</span><strong>{exams.length}개</strong></div></div>
        <button className="secondary full" onClick={() => onNavigate("report")}>성장 리포트 보기</button>
      </article>
    </section>

    <section className="v6-secondary-grid">
      <article className="panel v6-studymap-preview">
        <div className="v6-card-heading"><div><span className="eyebrow">TARGETED PRACTICE</span><h2>과목·주제 학습 상태</h2></div><button className="text-button" onClick={() => onNavigate("subject")}>과목별 보기</button></div>
        {subjectsLoading && <p className="muted">{certificate?.name} 과목별 학습 현황을 준비하고 있어요.</p>}
        {!subjectsLoading && subjectRows.slice(0, 6).map((item) => (
          <div className="v6-map-row" key={item.subject}>
            <div><strong>{item.subject}</strong><span>{item.coverage}%</span></div>
            <div className="v6-map-bar"><i style={{width:`${item.coverage}%`}} /></div>
            <small>{item.attempted ? `${item.attempted}문제 학습 · 정답률 ${item.accuracy}%` : `${item.available}문제 준비됨 · 아직 학습 전`}</small>
          </div>
        ))}
        {!subjectsLoading && !subjectRows.length && <p className="muted">과목별 학습 정보를 아직 확인할 수 없어요.</p>}
      </article>

      <article className="panel v6-reflection-card">
        <span className="eyebrow">LEARNING REFLECTION</span><h2>오늘 공부는 어땠나요?</h2>
        {reflection && <div className="v6-last-reflection"><span>최근 회고</span><strong>{reflection.difficulty || "기록됨"}</strong><p>{reflection.hardConcept || "어려웠던 개념을 기록하지 않았습니다."}</p></div>}
        <div className="v6-difficulty-buttons">{["어려웠음","보통","쉬웠음"].map((item) => <button key={item} className={difficulty === item ? "active" : ""} onClick={() => setDifficulty(item)}>{item}</button>)}</div>
        <label>오늘 가장 어려웠던 개념<input value={hardConcept} onChange={(e) => setHardConcept(e.target.value)} placeholder="예: 접지, 핀치오프, 전선 굵기" /></label>
        <button className="primary full" onClick={saveReflection}>학습 회고 저장</button>
      </article>
    </section>

    <section className="panel recent-learning-panel"><div className="section-heading"><div><span className="eyebrow">START LEARNING</span><h2>바로 학습하기</h2></div><button className="text-button" onClick={() => onNavigate("past")}>기출 전체 보기</button></div><div className="recent-learning-grid">{exams.slice(0, 3).map((exam) => <button className="recent-learning-card" key={exam.id} onClick={() => onOpenExam(exam)}><strong>{exam.title || `${exam.year || ""} 기출문제`}</strong><span>{exam.questionCount || 0}문제</span><small>풀이가 끝나면 오답과 다음 복습 목록이 업데이트돼요.</small></button>)}{!exams.length && <p className="muted">아직 학습할 시험이 없어요.</p>}</div></section>
  </main>;
}
