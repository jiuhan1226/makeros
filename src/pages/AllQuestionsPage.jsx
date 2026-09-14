import { useEffect, useMemo, useState } from "react";
import { shuffle } from "../utils/exam";
import { deduplicateQuestions } from "../utils/questionDedup";

function enrichQuestion(question, exam, certificate) {
  return {
    ...question,
    sourceExamId: exam?.id || question.sourceExamId || "",
    examId: question.examId || exam?.id || "",
    examTitle: question.examTitle || exam?.title || "",
    examYear: question.examYear || exam?.year || "",
    examDate: question.examDate || exam?.examDate || "",
    sourceName: question.sourceName || exam?.sourceName || "",
    certificateId: question.certificateId || exam?.certificateId || certificate?.id || "",
    certificateName: question.certificateName || exam?.certificateName || certificate?.name || "",
  };
}

export default function AllQuestionsPage({ certificate, exams = [], loadQuestions, onStart, onNavigate, resumeSession, onResume }) {
  const [loading, setLoading] = useState(true);
  const [loadedQuestions, setLoadedQuestions] = useState([]);
  const [questionCount, setQuestionCount] = useState(50);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all(exams.map(async (exam) => {
      const questions = await loadQuestions(exam.id).catch((error) => {
        console.error(`CBT 회차를 불러오지 못했습니다: ${exam.id}`, error);
        return [];
      });
      return questions.map((question) => enrichQuestion(question, exam, certificate));
    }))
      .then((groups) => { if (alive) setLoadedQuestions(groups.flat()); })
      .catch((error) => { console.error(error); if (alive) setLoadedQuestions([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [certificate?.id, exams, loadQuestions]);

  const result = useMemo(() => deduplicateQuestions(loadedQuestions), [loadedQuestions]);

  function start() {
    const requested = questionCount === "all" ? result.questions.length : Number(questionCount || 50);
    const pool = requested >= result.questions.length
      ? result.questions
      : shuffle(result.questions).slice(0, Math.min(requested, result.questions.length));
    const selected = pool.map((question, index) => ({ ...question, questionNumber: index + 1 }));
    if (!selected.length) return;
    onStart?.(selected, {
      id: `all-questions-${certificate?.id || "general"}-${Date.now()}`,
      title: `${certificate?.name || "자격증"} · 중복 없는 ${requested >= result.questions.length ? "전체 문제" : `${selected.length}문제`}`,
      durationMinutes: Math.max(1, selected.length),
      hasSubjectCutoff: false,
      assessmentType: "practice",
      studyScope: "all",
      learningType: "allPractice",
      returnPage: "all",
      questionCount: selected.length,
      duplicateCount: result.duplicateCount,
      totalAvailableQuestions: result.questions.length,
      certificateId: certificate?.id || "",
      certificateName: certificate?.name || "",
    });
  }

  return <main className="cbt-learning-layout">
    <aside className="cbt-side-menu">
      <button onClick={() => onNavigate?.("past")}>기출문제 학습</button>
      <button onClick={() => onNavigate?.("subject")}>과목별 학습</button>
      <button className="active" aria-current="page" disabled>전체 문제</button>
      <button onClick={() => onNavigate?.("saved")}>북마크</button>
    </aside>

    <section className="cbt-learning-content all-question-page">
      <div className="topic-result-heading">
        <div>
          <span className="eyebrow">ALL CBT QUESTIONS</span>
          <h1>{certificate?.name || "선택한 자격증"} 전체 문제</h1>
          <p>모든 회차의 같은 문제를 한 번만 남겨 이어서 풀 수 있어요.</p>
        </div>
        {!loading && <span>{result.questions.length.toLocaleString()}문제</span>}
      </div>

      {loading ? <div className="empty-state">전체 기출문제를 불러오고 있어요.</div> : result.questions.length ? <>
        {resumeSession && <section className="all-question-resume" role="status">
          <div><span>진행 중인 학습</span><strong>{resumeSession.title}</strong><small>{resumeSession.current + 1}/{resumeSession.total}번 문제 · 답변 {resumeSession.answered}개 저장됨</small></div>
          <button className="primary" onClick={onResume}>이어서 풀기</button>
        </section>}
        <section className="panel all-question-summary">
          <div>
            <span>학습할 문제</span>
            <strong>{result.questions.length.toLocaleString()}문제</strong>
            <small>{exams.length.toLocaleString()}개 회차 통합</small>
          </div>
          <div>
            <span>정리된 중복</span>
            <strong>{result.duplicateCount.toLocaleString()}문제</strong>
            <small>본문·보기·정답이 같은 문제</small>
          </div>
          <div className="all-question-actions">
            <label><span>이번 학습 분량</span><select value={questionCount} onChange={(event) => setQuestionCount(event.target.value === "all" ? "all" : Number(event.target.value))}><option value={20}>20문제 · 약 20분</option><option value={50}>50문제 · 약 50분</option><option value={100}>100문제 · 약 100분</option><option value="all">전체 문제</option></select></label>
            <button className="primary" onClick={start}>선택한 분량 시작</button>
          </div>
        </section>
        <p className="all-question-note">비슷해 보여도 본문이나 정답이 다른 문제는 삭제하지 않습니다.</p>
      </> : <div className="empty-state">이 자격증에는 아직 풀 수 있는 문제가 없습니다.</div>}
    </section>
  </main>;
}
