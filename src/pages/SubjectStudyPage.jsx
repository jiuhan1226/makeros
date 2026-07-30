import { useEffect, useMemo, useState } from "react";
import { shuffle } from "../utils/exam";
import { buildSubjectProgress, normalizeSubjectName } from "../utils/cbtSubjects";

export default function SubjectStudyPage({ certificate, exams, history = [], loadQuestions, onStart, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const storageKey = `studylock-selected-cbt-subject:${certificate?.id || "general"}`;
  const [selectedSubject, setSelectedSubject] = useState("전체");

  useEffect(() => {
    setSelectedSubject(localStorage.getItem(storageKey) || "전체");
  }, [storageKey]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all(
      exams.map(async (exam) =>
        (await loadQuestions(exam.id)).map((question) => ({
          ...question,
          sourceExam: exam,
        })),
      ),
    )
      .then((rows) => {
        if (alive) setQuestions(rows.flat());
      })
      .catch((error) => {
        console.error(error);
        if (alive) setQuestions([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [certificate?.id, exams, loadQuestions]);

  const subjects = useMemo(
    () => [...new Set(questions.map((question) => normalizeSubjectName(question?.subject)))],
    [questions],
  );

  const subjectRows = useMemo(() => {
    const catalog = subjects.map((subject) => ({
      subject,
      available: questions.filter((question) => normalizeSubjectName(question?.subject) === subject).length,
    }));
    const progress = new Map(buildSubjectProgress(catalog, history).map((item) => [item.subject, item]));
    return subjects.map((subject) => {
      const subjectQuestions = questions.filter(
        (question) => normalizeSubjectName(question?.subject) === subject,
      );
      const examCount = new Set(
        subjectQuestions.map((question) => question.sourceExam?.id).filter(Boolean),
      ).size;
      const years = [
        ...new Set(
          subjectQuestions
            .map((question) => Number(question.sourceExam?.year))
            .filter(Boolean),
        ),
      ].sort((a, b) => a - b);
      return { subject, questions: subjectQuestions, examCount, years, ...(progress.get(subject) || {}) };
    });
  }, [questions, subjects, history]);

  useEffect(() => {
    if (selectedSubject !== "전체") localStorage.setItem(storageKey, selectedSubject);
  }, [selectedSubject, storageKey]);

  useEffect(() => {
    if (!loading && selectedSubject !== "전체" && !subjects.includes(selectedSubject)) setSelectedSubject("전체");
  }, [loading, selectedSubject, subjects]);

  const visibleRows = useMemo(
    () =>
      selectedSubject === "전체"
        ? subjectRows
        : subjectRows.filter((row) => row.subject === selectedSubject),
    [selectedSubject, subjectRows],
  );

  function start(row, mode = "all") {
    const pool = row.questions.map(({ sourceExam, ...question }) => ({
      ...question,
      sourceExamId: sourceExam?.id || question.sourceExamId || "",
      sourceName: question.sourceName || sourceExam?.sourceName || "",
      examTitle: question.examTitle || sourceExam?.title || "",
      examYear: question.examYear || sourceExam?.year || "",
      examDate: question.examDate || sourceExam?.examDate || "",
      certificateId: sourceExam?.certificateId || certificate?.id || "",
      certificateName: sourceExam?.certificateName || certificate?.name || "",
    }));

    const selected = (mode === "quick" ? shuffle(pool).slice(0, Math.min(20, pool.length)) : pool)
      .map((question, index) => ({ ...question, questionNumber: index + 1 }));

    if (!selected.length) return;
    onStart?.(selected, {
      id: `subject-${certificate?.id || "general"}-${Date.now()}`,
      title: `${certificate?.name ? `${certificate.name} · ` : ""}${row.subject} · ${mode === "quick" ? "20문제 빠른 학습" : "전체 문제 학습"}`,
      durationMinutes: selected.length,
      hasSubjectCutoff: false,
      assessmentType: "practice",
      studyScope: "subject",
      returnPage: "subject",
      subject: row.subject,
      questionCount: selected.length,
      certificateId: certificate?.id || "",
      certificateName: certificate?.name || "",
    });
  }

  return (
    <main className="cbt-learning-layout">
      <aside className="cbt-side-menu">
        <button onClick={() => onNavigate?.("past")}>기출문제 학습</button>
        <button className="active" aria-current="page" disabled>과목별 학습</button>
        <button onClick={() => onNavigate?.("topic")}>주제별 학습</button>
      </aside>

      <section className="cbt-learning-content">
        <div className="topic-result-heading">
          <div>
            <span className="eyebrow">SUBJECT STUDY</span>
            <h1>{certificate?.name || "선택한 자격증"} 과목별 학습</h1>
            <p>원하는 과목을 골라 집중 학습하고, 풀이 결과를 바로 확인하세요.</p>
          </div>
          <span>{questions.length.toLocaleString()}문제</span>
        </div>

        {!loading && subjects.length > 1 && (
          <div className="topic-selector-block compact">
            <span>과목 보기</span>
            <div className="topic-subject-buttons">
              <button
                className={selectedSubject === "전체" ? "active" : ""}
                onClick={() => setSelectedSubject("전체")}
              >
                전체
              </button>
              {subjects.map((subject) => (
                <button
                  className={selectedSubject === subject ? "active" : ""}
                  onClick={() => setSelectedSubject(subject)}
                  key={subject}
                >
                  {subject}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="empty-state">{certificate?.name} 과목별 문제를 준비하고 있어요.</div>
        ) : (
          <div className="subject-study-grid">
            {visibleRows.map((row) => (
              <article className="subject-study-card subject-study-card-expanded" key={row.subject}>
                <div className="subject-card-heading">
                  <h2>{row.subject}</h2>
                  <span className="subject-total-badge">총 {row.questions.length.toLocaleString()}문제</span>
                </div>
                <p>
                  {row.examCount}개 시험 · {row.years.length ? `${row.years[0]}~${row.years[row.years.length - 1]}년` : "연도 미입력"}
                </p>
                <div className="topic-progress"><i style={{ width: `${row.coverage || 0}%` }} /></div>
                <small>
                  진행률 {row.coverage || 0}% · {row.attempted ? `${row.attempted}문제 학습 · 정답률 ${row.accuracy}%` : "아직 학습 전"}
                </small>
                <div className="subject-card-actions">
                  <button className="secondary" onClick={() => start(row, "quick")}>20문제 빠른 학습</button>
                  <button className="primary" onClick={() => start(row, "all")}>전체 {row.questions.length.toLocaleString()}문제 학습</button>
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && !visibleRows.length && (
          <div className="empty-state">{certificate?.name} 과목에서 학습할 문제를 찾지 못했어요.</div>
        )}
      </section>
    </main>
  );
}
