import { useMemo } from "react";
import { buildWrongNoteAnalysis } from "../utils/exam";
import { buildExamReadiness, buildTodayStudyPlan, buildWeakConcepts } from "../utils/learningEngine";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

export default function CertificateHomePage({
  certificate,
  exams = [],
  history = [],
  practiceHistory = [],
  wrongNotes = [],
  learningProgress = [],
  plan,
  pdfLibrary = [],
  onNavigate,
  onOpenExam,
  onStartRecommended,
}) {
  const analysis = useMemo(() => buildWrongNoteAnalysis(wrongNotes, history), [history, wrongNotes]);
  const weakConcepts = useMemo(() => buildWeakConcepts(learningProgress, 4), [learningProgress]);
  const readiness = useMemo(
    () => buildExamReadiness({ progress: learningProgress, history, exams, plan, passScore: Number(certificate?.passScore || 60) }),
    [certificate?.passScore, exams, history, learningProgress, plan],
  );
  const todayPlan = useMemo(
    () => buildTodayStudyPlan({ progress: learningProgress, wrongNotes, practiceHistory, plan, pdfLibrary, readiness }),
    [learningProgress, pdfLibrary, plan, practiceHistory, readiness, wrongNotes],
  );
  const weakSubject = weakConcepts[0]?.tag || analysis.weakSubjects[0]?.subject || "전체 과목";
  const recommendedCount = Math.max(10, Math.min(40, Number(readiness.recommendedDailyQuestions || todayPlan.dailyGoal || 15)));
  const recent = [...history, ...practiceHistory]
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, 4);

  return <main className="page-shell simple-learning-home">
    <section className="simple-learning-head">
      <div><span className="eyebrow">자격증 학습</span><h1>{certificate?.name || "자격증"}</h1></div>
    </section>

    <section className="panel simple-recommend-card">
      <div>
        <span>추천 학습 시작</span>
        <h2>{weakSubject}부터 {recommendedCount}문제</h2>
        <p>{history.length ? "최근 오답과 풀이 기록을 반영했습니다." : "첫 학습은 전체 과목을 고르게 확인합니다."}</p>
      </div>
      <button className="primary" onClick={() => onStartRecommended?.(weakSubject, recommendedCount)}>AI 추천 학습 시작</button>
    </section>

    <section className="simple-learning-summary" aria-label="오늘 학습 요약">
      <article><span>오늘 추천</span><strong>{recommendedCount}문제</strong></article>
      <article><span>복습 대기</span><strong>{todayPlan.due.length}문제</strong></article>
      <article><span>시험 준비</span><strong>{readiness.readinessScore}%</strong></article>
    </section>

    <section className="panel simple-learning-menu">
      <h2>다른 방식으로 공부하기</h2>
      <div>
        <button onClick={() => onNavigate("past")}><strong>기출문제</strong><span>회차별 실전 풀이</span></button>
        <button onClick={() => onNavigate("subject")}><strong>과목별</strong><span>과목을 골라 연습</span></button>
        <button onClick={() => onNavigate("topic")}><strong>주제별</strong><span>개념을 골라 연습</span></button>
        <button onClick={() => onNavigate("bookmark")}><strong>오답·복습</strong><span>틀린 문제 다시 풀기</span></button>
      </div>
    </section>

    <section className="panel simple-recent-learning">
      <div className="simple-section-head"><h2>최근 푼 문제</h2><button onClick={() => onNavigate("past")}>기출 전체</button></div>
      <div className="simple-recent-list">
        {recent.map((item, index) => <article key={item.sessionId || `${item.createdAt}:${index}`}>
          <div><strong>{item.title || "CBT 학습"}</strong><span>{formatDate(item.createdAt)} · {item.total || 0}문제</span></div>
          <b>{Number(item.score || 0)}점</b>
        </article>)}
        {!recent.length && exams.slice(0, 2).map((exam) => <button key={exam.id} onClick={() => onOpenExam?.(exam)}><span><strong>{exam.title || `${exam.year || ""} 기출문제`}</strong><small>{exam.questionCount || 0}문제</small></span><b>시작</b></button>)}
        {!recent.length && !exams.length && <p>아직 푼 문제가 없습니다.</p>}
      </div>
    </section>
  </main>;
}
