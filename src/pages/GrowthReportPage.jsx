import { useMemo } from "react";
import {
  buildRepeatedWrong,
  buildWeakConcepts,
  difficultySummary,
  estimatePassProjection,
  getDueReviews,
} from "../utils/learningEngine";

export default function GrowthReportPage({
  certificate,
  history = [],
  practiceHistory = [],
  studyEvents = [],
  wrongNotes = [],
  learningProgress = [],
}) {
  const report = useMemo(() => {
    const recent = history.slice(0, 8).reverse();
    const total = history.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const correct = history.reduce((sum, item) => sum + Number(item.correct || 0), 0);
    const scores = recent.map((item) => Number(item.score || 0));
    const delta = scores.length > 1 ? scores.at(-1) - scores[0] : 0;
    const weeks = Array.from({ length: 6 }, (_, index) => {
      const start = Date.now() - (5 - index) * 7 * 86400000;
      const end = start + 7 * 86400000;
      return studyEvents
        .filter((event) => event.createdAt >= start && event.createdAt < end)
        .reduce((sum, event) => sum + Number(event.questionCount || 0), 0);
    });
    return { total, accuracy: total ? Math.round((correct / total) * 100) : 0, delta, scores, weeks };
  }, [history, studyEvents]);
  const projection = useMemo(
    () => estimatePassProjection(history, Number(certificate?.passScore || 60)),
    [certificate?.passScore, history],
  );
  const weak = useMemo(() => buildWeakConcepts(learningProgress, 6), [learningProgress]);
  const repeated = useMemo(() => buildRepeatedWrong(learningProgress), [learningProgress]);
  const due = useMemo(() => getDueReviews(learningProgress), [learningProgress]);
  const difficulties = useMemo(() => difficultySummary(learningProgress), [learningProgress]);
  const practiceSolved = practiceHistory.reduce((sum, item) => sum + Number(item.total || 0), 0);

  return (
    <main className="page-shell">
      <section className="page-title">
        <div>
          <span className="eyebrow">CBT GROWTH REPORT</span>
          <h1>{certificate?.name} 성장 리포트</h1>
          <p>성적 흐름, 학습량, 취약 개념을 한눈에 확인하세요.</p>
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card"><span>실전 풀이</span><strong>{report.total}문제</strong><small>실전 시험과 모의고사</small></article>
        <article className="stat-card"><span>연습 풀이</span><strong>{practiceSolved}문제</strong><small>과목·주제·복습 학습</small></article>
        <article className="stat-card"><span>합격 가능성</span><strong>{projection.probability === null ? "분석 전" : `${projection.probability}%`}</strong><small>{projection.label}</small></article>
        <article className="stat-card"><span>오늘 복습 대기</span><strong>{due.length}문제</strong><small>반복 오답 {repeated.length}문제</small></article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <h2>최근 시험형 성적 추이</h2>
          {report.scores.length ? (
            <div className="score-bars">
              {report.scores.map((score, index) => <div key={index}><i style={{ height: `${Math.max(4, score)}%` }} /><span>{score}</span></div>)}
            </div>
          ) : <p className="muted">실전 풀이 기록이 쌓이면 성적 추이를 확인할 수 있어요.</p>}
        </article>
        <article className="panel">
          <h2>최근 6주 전체 CBT 풀이량</h2>
          <div className="weekly-bars">
            {report.weeks.map((value, index) => <div key={index}><i style={{ height: `${Math.max(4, Math.min(100, value))}%` }} /><span>{value}</span></div>)}
          </div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <h2>취약 개념 숙련도</h2>
          {weak.length ? weak.map((item) => (
            <div className="weakness-row" key={item.tag}>
              <div><b>{item.tag}</b><span>{item.mastery}%</span></div>
              <div className="weakness-bar"><i style={{ width: `${item.mastery}%` }} /></div>
            </div>
          )) : <p className="muted">문제를 풀고 자기평가를 남기면 숙련도가 표시돼요.</p>}
        </article>
        <article className="panel">
          <h2>개인 난이도 분포</h2>
          <div className="difficulty-summary-grid compact">
            <article><span>어려움</span><strong>{difficulties.hard}</strong></article>
            <article><span>보통</span><strong>{difficulties.medium}</strong></article>
            <article><span>쉬움</span><strong>{difficulties.easy}</strong></article>
            <article><span>분석 중</span><strong>{difficulties.pending}</strong></article>
          </div>
        </article>
      </section>

      <section className="panel growth-message">
        <h2>이번 리포트</h2>
        <p>
          {projection.expectedScore !== null
            ? `최근 실전 기록을 바탕으로 예상 점수는 ${projection.expectedScore}점, 합격 가능성은 ${projection.probability}%로 분석됐어요. `
            : "실전 기록이 더 쌓이면 예상 점수와 합격 가능성을 확인할 수 있어요. "}
          {report.delta > 0
            ? `최근 점수가 ${report.delta}점 상승했습니다.`
            : report.delta < 0
              ? `최근 점수가 ${Math.abs(report.delta)}점 하락했습니다.`
              : "최근 점수 변화는 크지 않습니다."}
          {wrongNotes.length ? ` 지금 복습할 오답이 ${wrongNotes.length}문제 있어요.` : " 현재 복습할 오답은 없어요."}
        </p>
        <small>예상 점수와 합격 가능성은 학습 계획을 돕기 위한 참고 지표입니다.</small>
      </section>
    </main>
  );
}
