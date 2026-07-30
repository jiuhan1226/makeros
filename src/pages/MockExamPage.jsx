import { useEffect, useMemo, useState } from "react";
import {
  examDateLabel,
  examDateValue,
  examYears,
  mockCountOptions,
  officialQuestionCount,
  selectBalancedQuestions,
} from "../utils/exam";

export default function MockExamPage({ exams, loadQuestions, onStart }) {
  const years = useMemo(() => examYears(exams), [exams]);
  const fullCount = useMemo(() => officialQuestionCount(exams), [exams]);
  const countOptions = useMemo(() => mockCountOptions(exams), [exams]);
  const [scope, setScope] = useState("all");
  const [year, setYear] = useState(years[0] || new Date().getFullYear());
  const [selectedExamIds, setSelectedExamIds] = useState([]);
  const [count, setCount] = useState(fullCount);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setCount(fullCount);
  }, [fullCount]);

  useEffect(() => {
    if (!years.includes(Number(year)) && years.length) setYear(years[0]);
  }, [years, year]);

  const yearExams = useMemo(
    () => exams
      .filter((exam) => Number(exam.year) === Number(year))
      .sort((a, b) => examDateValue(b).localeCompare(examDateValue(a)) || String(b.round).localeCompare(String(a.round), "ko")),
    [exams, year],
  );

  useEffect(() => {
    setSelectedExamIds((current) => current.filter((id) => yearExams.some((exam) => exam.id === id)));
  }, [yearExams]);

  const targets = useMemo(() => {
    if (scope === "all") return exams;
    return yearExams.filter((exam) => selectedExamIds.includes(exam.id));
  }, [exams, scope, selectedExamIds, yearExams]);

  function toggleExam(examId) {
    setSelectedExamIds((current) => current.includes(examId)
      ? current.filter((id) => id !== examId)
      : [...current, examId]);
  }

  function selectAllDates() {
    setSelectedExamIds(yearExams.map((exam) => exam.id));
  }

  async function create() {
    setBusy(true);
    setMessage("");
    try {
      if (!targets.length) throw new Error("출제할 시험 날짜를 하나 이상 선택해 주세요.");
      const questionBatches = await Promise.all(targets.map(async (exam) => ({
        exam,
        questions: await loadQuestions(exam.id),
      })));
      const result = selectBalancedQuestions(questionBatches, count);
      const selectedDateText = scope === "all"
        ? "전체 연도"
        : targets.map((exam) => `${exam.year}년 ${examDateLabel(exam)}`).join(", ");
      onStart(result.questions, {
        id: `mock-${Date.now()}`,
        title: "맞춤 모의고사",
        durationMinutes: count,
        questionCount: count,
        sourceRange: selectedDateText,
        subjectQuota: result.quota,
        grade: targets[0]?.grade || exams[0]?.grade || "",
        hasSubjectCutoff: targets[0]?.hasSubjectCutoff ?? exams[0]?.hasSubjectCutoff,
        passScore: targets[0]?.passScore ?? exams[0]?.passScore ?? 60,
        subjectCutoffScore: targets[0]?.subjectCutoffScore ?? exams[0]?.subjectCutoffScore ?? 40,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "모의고사 생성에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell">
      <div className="page-heading">
        <span className="eyebrow">CUSTOM MOCK EXAM</span>
        <h1>맞춤 모의고사</h1>
        <p>원하는 범위와 문항 수를 선택해 나만의 모의고사를 만들어 보세요.</p>
      </div>

      <section className="mock-builder panel">
        <h2>출제 범위</h2>
        <div className="segmented">
          <button className={scope === "all" ? "active" : ""} onClick={() => setScope("all")}>전체 연도</button>
          <button className={scope === "dates" ? "active" : ""} onClick={() => setScope("dates")}>시험 날짜 선택</button>
        </div>

        {scope === "dates" && (
          <div className="mock-date-picker">
            <label className="mock-year-select">
              연도
              <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
                {years.map((value) => <option key={value} value={value}>{value}년</option>)}
              </select>
            </label>

            <div className="mock-date-header">
              <strong>시험 날짜</strong>
              <button type="button" className="text-button" onClick={selectAllDates}>이 연도 전체 선택</button>
            </div>
            <div className="exam-date-options">
              {yearExams.map((exam) => (
                <label className={`exam-date-option ${selectedExamIds.includes(exam.id) ? "selected" : ""}`} key={exam.id}>
                  <input
                    type="checkbox"
                    checked={selectedExamIds.includes(exam.id)}
                    onChange={() => toggleExam(exam.id)}
                  />
                  <span>
                    <strong>{examDateLabel(exam)}</strong>
                    <small>{exam.round || exam.title} · {exam.questionCount || 0}문제</small>
                  </span>
                </label>
              ))}
              {!yearExams.length && <div className="empty-state compact">선택한 연도의 시험이 없습니다.</div>}
            </div>
          </div>
        )}

        <h2>문항 수</h2>
        <div className="segmented mock-counts">
          {countOptions.map((value) => (
            <button key={value} className={count === value ? "active" : ""} onClick={() => setCount(value)}>
              {value}문제{value === fullCount ? <small>실제 시험</small> : null}
            </button>
          ))}
        </div>
        <p className="mock-info">제한 시간은 {count}분입니다. 과목별 비율을 반영해 문제가 고르게 구성됩니다.</p>

        <button className="primary wide" disabled={busy || !targets.length} onClick={create}>
          {busy ? "모의고사를 준비하고 있어요..." : `${count}문제 모의고사 생성`}
        </button>
        {message && <p className="error-box">{message}</p>}
      </section>
    </main>
  );
}
