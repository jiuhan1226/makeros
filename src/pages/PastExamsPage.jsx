import { useEffect, useMemo, useState } from "react";
import { examYears } from "../utils/exam";

function subjectOf(question) {
  return String(question?.subject || "공통").trim() || "공통";
}

export default function PastExamsPage({ exams = [], loadQuestions, resumeSessions = [], onResume, onOpen, onNavigate }) {
  const years = examYears(exams);
  const [questionMap, setQuestionMap] = useState({});
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const recentDraft = [...resumeSessions].sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0))[0] || null;

  useEffect(() => {
    let alive = true;
    setLoadingSubjects(true);
    Promise.all(exams.map(async (exam) => [exam.id, await loadQuestions(exam.id)]))
      .then((entries) => { if (alive) setQuestionMap(Object.fromEntries(entries)); })
      .catch((error) => { console.error(error); if (alive) setQuestionMap({}); })
      .finally(() => { if (alive) setLoadingSubjects(false); });
    return () => { alive = false; };
  }, [exams, loadQuestions]);

  const subjectRows = useMemo(() => {
    const map = new Map();
    for (const exam of exams) {
      for (const question of questionMap[exam.id] || []) {
        const subject = subjectOf(question);
        const current = map.get(subject) || { subject, count: 0, examIds: new Set(), years: new Set() };
        current.count += 1;
        current.examIds.add(exam.id);
        if (exam.year) current.years.add(Number(exam.year));
        map.set(subject, current);
      }
    }
    return [...map.values()].map((item) => ({
      ...item,
      examCount: item.examIds.size,
      yearList: [...item.years].sort((a, b) => a - b),
    })).sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject, "ko"));
  }, [exams, questionMap]);

  function openSubject(subject) {
    localStorage.setItem("studylock-selected-cbt-subject", subject);
    onNavigate?.("subject");
  }

  return <main className="cbt-learning-layout">
    <aside className="cbt-side-menu">
      <button className="active" aria-current="page" disabled>기출문제 학습</button>
      <button onClick={() => onNavigate?.("subject")}>과목별 학습</button>
      <button onClick={() => onNavigate?.("all")}>전체 문제</button>
      <button onClick={() => onNavigate?.("saved")}>북마크</button>
    </aside>

    <section className="cbt-learning-content">
      <div className="page-heading">
        <span className="eyebrow">OFFICIAL CBT</span>
        <h1>CBT 기출문제</h1>
        <p>회차별 기출과 과목별 문제를 원하는 방식으로 풀어보세요.</p>
      </div>

      {recentDraft && <section className="panel past-resume-banner">
        <div><span>저장된 풀이 {resumeSessions.length > 1 ? `${resumeSessions.length}개` : ""}</span><strong>{recentDraft.title}</strong><small>{recentDraft.answered}/{recentDraft.total}문제 답변 · {Math.min(recentDraft.total, Number(recentDraft.current || 0) + 1)}번 문제부터 계속</small></div>
        <button className="primary" onClick={() => onResume?.(recentDraft.checkpointKey)}>이어풀기</button>
      </section>}

      <section className="panel cbt-subject-overview">
        <div className="section-title">
          <div><span className="eyebrow">SUBJECTS</span><h2>과목별 CBT</h2><p>과목별 문제 수와 출제 회차를 한눈에 확인하고 바로 학습할 수 있어요.</p></div>
          <button className="secondary" onClick={() => onNavigate?.("subject")}>과목별 전체 화면</button>
        </div>
        {loadingSubjects ? <div className="empty-state compact">과목별 문제를 준비하고 있어요.</div> : <div className="cbt-subject-card-grid">
          {subjectRows.map((row) => <button key={row.subject} onClick={() => openSubject(row.subject)}>
            <span>{row.subject}</span>
            <strong>{row.count.toLocaleString()}문제</strong>
            <small>{row.examCount}개 회차{row.yearList.length ? ` · ${row.yearList[0]}~${row.yearList.at(-1)}년` : ""}</small>
          </button>)}
          {!subjectRows.length && <div className="empty-state compact">과목 정보를 확인할 수 있는 문제가 아직 없어요.</div>}
        </div>}
      </section>

      {years.map((year) => <section className="year-section" key={year}>
        <div className="year-title-row"><h2>{year}년 회차별 CBT</h2><span>{exams.filter((exam) => Number(exam.year) === year).length}개 회차</span></div>
        <div className="exam-grid">{exams.filter((exam) => Number(exam.year) === year).map((exam) => {
          const counts = new Map();
          for (const question of questionMap[exam.id] || []) counts.set(subjectOf(question), (counts.get(subjectOf(question)) || 0) + 1);
          const resumable = resumeSessions.find((item) => item.examId === exam.id);
          const isResumable = Boolean(resumable);
          return <article className="exam-card modern-exam-card" key={exam.id}>
            <span className="cbt-badge">CBT</span>
            <h3>{exam.round}</h3>
            <p>{exam.questionCount || 0}문제 · {exam.durationMinutes || 0}분</p>
            <div className="exam-subject-chips">{[...counts.entries()].map(([subject, count]) => <button key={subject} onClick={() => openSubject(subject)}>{subject} <b>{count}</b></button>)}</div>
            {isResumable && <div className="exam-resume-progress"><span style={{ width: `${Math.max(0, Math.min(100, (resumable.answered / Math.max(1, resumable.total)) * 100))}%` }}/></div>}
            <button className="primary" onClick={() => isResumable ? onResume?.(resumable.checkpointKey) : onOpen(exam)}>{isResumable ? `이어풀기 · ${resumable.answered}/${resumable.total}` : "이 회차 전체 풀기"}</button>
          </article>;
        })}</div>
      </section>)}
      {!years.length && <div className="empty-state">아직 등록된 기출문제가 없어요.</div>}
    </section>
  </main>;
}
