import { useEffect, useMemo, useState } from "react";
import { shuffle } from "../utils/exam";

const TOPIC_FIELDS = ["topic", "chapter", "unit", "category", "subTopic", "keyword"];

function normalizeTopic(question) {
  for (const field of TOPIC_FIELDS) {
    const value = question?.[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  if (Array.isArray(question?.tags) && question.tags.length) {
    const tag = String(question.tags[0] || "").trim();
    if (tag) return tag;
  }
  return "미분류 주제";
}

function normalizeSubject(question) {
  return String(question?.subject || "공통").trim() || "공통";
}

function groupSelectedQuestions(batches, fromYear, toYear) {
  const map = new Map();
  let totalQuestions = 0;

  batches.forEach(({ exam, questions }) => {
    const year = Number(exam?.year || 0);
    if (!year || year < fromYear || year > toYear) return;

    (questions || []).forEach((question) => {
      totalQuestions += 1;
      const subject = normalizeSubject(question);
      const topic = normalizeTopic(question);
      const key = `${subject}|||${topic}`;
      const row = map.get(key) || {
        subject,
        topic,
        questions: [],
        examIds: new Set(),
        years: new Set(),
      };
      row.questions.push({ ...question, sourceExam: exam });
      if (exam?.id) row.examIds.add(exam.id);
      row.years.add(year);
      map.set(key, row);
    });
  });

  return {
    totalQuestions,
    groups: [...map.values()].map((row) => ({
      ...row,
      examCount: row.examIds.size,
      years: [...row.years].sort((a, b) => a - b),
    })),
  };
}

export default function TopicStudyPage({ exams, loadQuestions, onStart, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState([]);
  const [subject, setSubject] = useState("전체");
  const [minCount, setMinCount] = useState(1);
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all(
      exams.map(async (exam) => ({ exam, questions: await loadQuestions(exam.id) })),
    )
      .then((rows) => {
        if (alive) setBatches(rows);
      })
      .catch((error) => {
        console.error(error);
        if (alive) setBatches([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [exams, loadQuestions]);

  const years = useMemo(
    () => [...new Set(exams.map((exam) => Number(exam.year)).filter(Boolean))].sort((a, b) => a - b),
    [exams],
  );

  useEffect(() => {
    if (!years.length) return;
    if (!yearFrom) setYearFrom(String(years[0]));
    if (!yearTo) setYearTo(String(years[years.length - 1]));
  }, [years, yearFrom, yearTo]);

  const selectedData = useMemo(() => {
    const from = Number(yearFrom || years[0] || 0);
    const to = Number(yearTo || years[years.length - 1] || 9999);
    return groupSelectedQuestions(batches, Math.min(from, to), Math.max(from, to));
  }, [batches, yearFrom, yearTo, years]);

  const subjects = useMemo(
    () => ["전체", ...new Set(selectedData.groups.map((group) => group.subject))],
    [selectedData.groups],
  );

  useEffect(() => {
    if (subject !== "전체" && !subjects.includes(subject)) setSubject("전체");
  }, [subject, subjects]);

  const filtered = useMemo(
    () =>
      selectedData.groups
        .filter((group) => {
          if (subject !== "전체" && group.subject !== subject) return false;
          return group.examCount >= minCount;
        })
        .sort((a, b) => b.questions.length - a.questions.length || a.topic.localeCompare(b.topic, "ko")),
    [selectedData.groups, subject, minCount],
  );

  function startGroup(group, mode = "all") {
    const pool = group.questions.map(({ sourceExam, ...question }) => ({
      ...question,
      sourceExamId: sourceExam?.id || question.sourceExamId || "",
      sourceName: question.sourceName || sourceExam?.sourceName || "",
      examTitle: question.examTitle || sourceExam?.title || "",
      examYear: question.examYear || sourceExam?.year || "",
      examDate: question.examDate || sourceExam?.examDate || "",
      topic: group.topic,
    }));

    const selected = (mode === "quick" ? shuffle(pool).slice(0, Math.min(20, pool.length)) : pool)
      .map((question, index) => ({ ...question, questionNumber: index + 1 }));

    if (!selected.length) return;
    onStart?.(selected, {
      id: `topic-${Date.now()}`,
      title: `${group.topic} · ${mode === "quick" ? "20문제 빠른 학습" : "전체 문제 학습"}`,
      durationMinutes: selected.length,
      hasSubjectCutoff: false,
      studyScope: "topic",
      subject: group.subject,
      topic: group.topic,
      yearFrom: Number(yearFrom),
      yearTo: Number(yearTo),
      questionCount: selected.length,
    });
  }

  const selectedFrom = Math.min(Number(yearFrom || 0), Number(yearTo || 0));
  const selectedTo = Math.max(Number(yearFrom || 0), Number(yearTo || 0));

  return (
    <main className="cbt-learning-layout">
      <aside className="cbt-side-menu">
        <button onClick={() => onNavigate?.("past")}>기출문제 학습</button>
        <button onClick={() => onNavigate?.("subject")}>과목별 학습</button>
        <button className="active" aria-current="page" disabled>주제별 학습</button>
        
      </aside>

      <section className="cbt-learning-content">
        <div className="topic-filter-top">
          <div className="year-range-control">
            <span>분류할 연도 선택</span>
            <select value={yearFrom} onChange={(event) => setYearFrom(event.target.value)}>
              {years.map((year) => <option value={year} key={year}>{year}년</option>)}
            </select>
            <b>~</b>
            <select value={yearTo} onChange={(event) => setYearTo(event.target.value)}>
              {years.map((year) => <option value={year} key={year}>{year}년</option>)}
            </select>
          </div>
        </div>

        <div className="topic-range-summary">
          <div><strong>{selectedFrom || "-"}~{selectedTo || "-"}년</strong><span>선택 연도 범위</span></div>
          <div><strong>{selectedData.totalQuestions.toLocaleString()}문제</strong><span>분류 대상 전체 문제</span></div>
          <div><strong>{selectedData.groups.length.toLocaleString()}개</strong><span>분류된 주제</span></div>
        </div>

        <div className="topic-selector-block">
          <span>과목 선택</span>
          <div className="topic-subject-buttons">
            {subjects.map((item) => (
              <button
                className={subject === item ? "active" : ""}
                onClick={() => setSubject(item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="topic-selector-block compact">
          <span>출제 회차</span>
          <div className="segmented">
            <button className={minCount === 1 ? "active" : ""} onClick={() => setMinCount(1)}>전체 주제</button>
            <button className={minCount === 3 ? "active" : ""} onClick={() => setMinCount(3)}>3회 이상</button>
            <button className={minCount === 5 ? "active" : ""} onClick={() => setMinCount(5)}>5회 이상</button>
            <button className={minCount === 10 ? "active" : ""} onClick={() => setMinCount(10)}>10회 이상</button>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">선택 연도의 모든 문제를 주제별로 분류하고 있습니다.</div>
        ) : (
          <>
            <div className="topic-result-heading">
              <div>
                <h2>주제별 학습</h2>
                <p>{selectedFrom}~{selectedTo}년에 등록된 모든 문제를 기준으로 분류했습니다.</p>
              </div>
              <span>{filtered.length}개 주제</span>
            </div>

            <div className="topic-card-grid">
              {filtered.map((group) => (
                <article className="topic-study-card" key={`${group.subject}-${group.topic}`}>
                  <span className="topic-subject-label">{group.subject}</span>
                  <h3>{group.topic}</h3>
                  <p>
                    선택 연도 문제 {group.questions.length.toLocaleString()}개 · {group.examCount}개 시험에서 출제
                  </p>
                  <div className="topic-progress"><i style={{ width: "0%" }} /></div>
                  <small>학습률 0% · 0/{group.questions.length.toLocaleString()}</small>
                  <div className="topic-card-actions">
                    <button className="secondary" onClick={() => startGroup(group, "quick")}>20문제 빠른 학습</button>
                    <button className="primary" onClick={() => startGroup(group, "all")}>전체 학습</button>
                  </div>
                </article>
              ))}
            </div>

            {!filtered.length && (
              <div className="empty-state">
                조건에 맞는 주제가 없습니다. 문제 데이터의 topic, chapter, unit, category, subTopic 또는 tags 필드를 확인하세요.
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
