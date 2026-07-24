import { useMemo } from "react";
import StatCard from "../components/StatCard";

function dayKey(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10); }

export default function StudyStatsPage({ history = [], studyEvents = [] }) {
  const stats = useMemo(() => {
    const totalQuestions = history.reduce((s, h) => s + Number(h.total || 0), 0);
    const totalCorrect = history.reduce((s, h) => s + Number(h.correct || 0), 0);
    const totalSeconds = studyEvents.reduce((s, e) => s + Number(e.durationSeconds || 0), 0);
    const days = new Set(studyEvents.map(e => dayKey(e.createdAt)).filter(Boolean));
    const subject = new Map();
    history.forEach(h => (h.subjects || []).forEach(x => {
      const old = subject.get(x.subject) || { subject: x.subject, total: 0, correct: 0 };
      old.total += Number(x.total || 0); old.correct += Number(x.correct || 0); subject.set(x.subject, old);
    }));
    return { totalQuestions, accuracy: totalQuestions ? Math.round(totalCorrect / totalQuestions * 100) : 0, totalMinutes: Math.round(totalSeconds / 60), days: days.size, subjects: [...subject.values()].map(x => ({...x, score: x.total ? Math.round(x.correct / x.total * 100) : 0})).sort((a,b)=>a.score-b.score) };
  }, [history, studyEvents]);

  const recentDays = Array.from({length: 28}, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (27-i)); const key = d.toISOString().slice(0,10); return { key, active: studyEvents.some(e => dayKey(e.createdAt) === key) }; });
  return <main className="page-shell">
    <section className="page-title"><div><span className="eyebrow">CBT STUDY REPORT</span><h1>CBT 학습 통계</h1><p>PDF 학습과 분리된 자격증 CBT 풀이 기록과 과목별 정답률을 확인합니다.</p></div></section>
    <section className="stats-grid"><StatCard label="총 풀이" value={`${stats.totalQuestions}문제`} /><StatCard label="전체 정답률" value={`${stats.accuracy}%`} /><StatCard label="학습 시간" value={`${stats.totalMinutes}분`} /><StatCard label="학습한 날" value={`${stats.days}일`} /></section>
    <section className="dashboard-grid"><article className="panel"><h2>최근 4주 학습</h2><div className="heatmap">{recentDays.map(d => <span key={d.key} className={d.active ? "heat active" : "heat"} title={d.key} />)}</div><p className="muted">CBT 시험 또는 CBT 연습을 완료한 날이 진하게 표시됩니다.</p></article>
    <article className="panel"><h2>과목별 정답률</h2>{stats.subjects.length ? stats.subjects.map(s => <div className="subject-stat" key={s.subject}><div><span>{s.subject}</span><strong>{s.score}%</strong></div><div className="mini-progress"><i style={{width:`${s.score}%`}} /></div></div>) : <p className="muted">아직 학습 기록이 없습니다.</p>}</article></section>
    <section className="panel"><h2>최근 CBT 기록</h2><div className="history-table">{history.slice(0,10).map((h,i)=><div className="history-row" key={`${h.createdAt}-${i}`}><span>{h.title}</span><strong>{h.score}점 · {h.resultLabel || (h.passed ? "합격" : "불합격")}</strong><small>{new Date(h.createdAt).toLocaleString("ko-KR")}</small></div>)}{!history.length&&<p className="muted">기록이 없습니다.</p>}</div></section>
  </main>;
}
