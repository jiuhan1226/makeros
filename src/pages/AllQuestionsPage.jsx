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

export default function AllQuestionsPage({ certificate, exams = [], loadQuestions, onStart, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [loadedQuestions, setLoadedQuestions] = useState([]);

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

  function start(mode) {
    const pool = mode === "quick"
      ? shuffle(result.questions).slice(0, Math.min(20, result.questions.length))
      : result.questions;
    const selected = pool.map((question, index) => ({ ...question, questionNumber: index + 1 }));
    if (!selected.length) return;
    onStart?.(selected, {
      id: `all-questions-${certificate?.id || "general"}-${Date.now()}`,
      title: `${certificate?.name || "자격증"} · ${mode === "quick" ? "중복 없는 20문제" : "중복 없는 전체 문제"}`,
      durationMinutes: Math.max(1, selected.length),
      hasSubjectCutoff: false,
      assessmentType: "practice",
      studyScope: "all",
      learningType: "allPractice",
      returnPage: "all",
      questionCount: selected.length,
      duplicateCount: result.duplicateCount,
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
            <button className="secondary" onClick={() => start("quick")}>20문제 빠르게</button>
            <button className="primary" onClick={() => start("all")}>전체 문제 풀기</button>
          </div>
        </section>
        <p className="all-question-note">비슷해 보여도 본문이나 정답이 다른 문제는 삭제하지 않습니다.</p>
      </> : <div className="empty-state">이 자격증에는 아직 풀 수 있는 문제가 없습니다.</div>}
    </section>
  </main>;
}
