import { useEffect, useMemo, useState } from "react";
import { shuffle } from "../utils/exam";
import { consolidateQuestionTopics, normalizeQuestionTopic } from "../utils/topicClassifier.js";

function normalizeSubject(question) {
  return String(question?.subject || "공통").trim() || "공통";
}

function groupSelectedQuestions(batches, fromYear, toYear) {
  const selectedQuestions = [];
  const selectedExamIds = new Set();

  batches.forEach(({ exam, questions }) => {
    const year = Number(exam?.year || 0);
    if (!year || year < fromYear || year > toYear) return;
    if (exam?.id) selectedExamIds.add(exam.id);

    (questions || []).forEach((question) => {
      selectedQuestions.push({
        ...question,
        sourceExam: exam,
        sourceExamId: question.sourceExamId || exam?.id || "",
        examYear: question.examYear || exam?.year || "",
      });
    });
  });

  // 같은 과목에서 2문제 미만인 세부 주제는 내용상 가까운 상위 주제로 통합합니다.
  const consolidated = consolidateQuestionTopics(
    selectedQuestions,
    { minTopicSize: 2 },
  );

  const map = new Map();
  consolidated.questions.forEach((normalizedQuestion) => {
    const subject = normalizeSubject(normalizedQuestion);
    const topic = normalizedQuestion.topic;
    const key = `${subject}|||${topic}`;
    const row = map.get(key) || {
      subject,
      topic,
      questions: [],
      examIds: new Set(),
      years: new Set(),
      autoClassified: 0,
      mergedQuestions: 0,
    };
    row.questions.push(normalizedQuestion);
    if (!["metadata", "tag"].includes(normalizedQuestion.topicSource)) row.autoClassified += 1;
    if (normalizedQuestion.topicMergedFrom) row.mergedQuestions += 1;
    const sourceExam = normalizedQuestion.sourceExam;
    if (sourceExam?.id) row.examIds.add(sourceExam.id);
    const year = Number(sourceExam?.year || normalizedQuestion.examYear || 0);
    if (year) row.years.add(year);
    map.set(key, row);
  });

  return {
    totalQuestions: selectedQuestions.length,
    selectedExamCount: selectedExamIds.size,
    groups: [...map.values()].map((row) => ({
      ...row,
      examCount: row.examIds.size,
      years: [...row.years].sort((a, b) => a - b),
    })),
    mergeMap: consolidated.mergeMap,
    consolidationStats: consolidated.stats,
  };
}

export default function TopicStudyPage({ certificate, exams, history = [], learningProgress = [], loadQuestions, onStart, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState([]);
  const [subject, setSubject] = useState("전체");
  const [minExamCount, setMinExamCount] = useState(0);
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


  const topicProgress = useMemo(() => {
    const map = new Map();
    const mergeMap = selectedData.mergeMap || new Map();

    for (const item of learningProgress) {
      if (item?.studyScope !== "topic") continue;
      const normalized = normalizeQuestionTopic(item);
      const itemSubject = String(item.subject || normalized.subject || "공통").trim() || "공통";
      const questionId = String(item.questionId || item.id || "");
      const mergedTopic = mergeMap.get(questionId)
        || mergeMap.get(`${itemSubject}|||${normalized.topic}`)
        || normalized.topic;
      const key = `${itemSubject}|||${mergedTopic}`;
      const current = map.get(key) || { attempts: 0, correct: 0, questionIds: new Set() };
      current.attempts += Number(item.attemptCount || 0);
      current.correct += Number(item.correctCount || 0);
      if (questionId) current.questionIds.add(questionId);
      map.set(key, current);
    }

    // 이전 버전의 세션 기록도 현재 통합 주제명으로 연결합니다.
    for (const item of history) {
      if (item?.studyScope !== "topic" || !item.topic || /^미분류/.test(String(item.topic))) continue;
      const itemSubject = String(item.subject || "공통").trim() || "공통";
      const mergedTopic = mergeMap.get(`${itemSubject}|||${item.topic}`) || item.topic;
      const key = `${itemSubject}|||${mergedTopic}`;
      if (map.has(key)) continue;
      map.set(key, { attempts: Number(item.total || 0), correct: Number(item.correct || 0), questionIds: new Set() });
    }
    return map;
  }, [history, learningProgress, selectedData.mergeMap]);

  const filtered = useMemo(
    () =>
      selectedData.groups
        .filter((group) => {
          if (subject !== "전체" && group.subject !== subject) return false;
          return group.examCount >= minExamCount;
        })
        .sort((a, b) => b.questions.length - a.questions.length || a.topic.localeCompare(b.topic, "ko")),
    [selectedData.groups, subject, minExamCount],
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
      assessmentType: "practice",
      studyScope: "topic",
      returnPage: "topic",
      subject: group.subject,
      topic: group.topic,
      yearFrom: Number(yearFrom),
      yearTo: Number(yearTo),
      questionCount: selected.length,
      certificateId: certificate?.id || "",
      certificateName: certificate?.name || "",
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
            <span>학습 연도 선택</span>
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
          <div><strong>{selectedData.totalQuestions.toLocaleString()}문제</strong><span>선택 범위 문제</span></div>
          <div>
            <strong>{selectedData.groups.length.toLocaleString()}개</strong>
            <span>
              학습 주제
              {selectedData.consolidationStats?.originalTopicCount > selectedData.groups.length
                ? ` · 정리 전 ${selectedData.consolidationStats.originalTopicCount}개`
                : ""}
            </span>
          </div>
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

        <div className="topic-selector-block compact topic-frequency-filter">
          <span>출제 빈도</span>
          <p className="topic-filter-help">
            여러 시험에 반복해서 출제된 핵심 주제를 우선 살펴보세요.
          </p>
          <div className="segmented">
            <button className={minExamCount === 0 ? "active" : ""} onClick={() => setMinExamCount(0)}>전체</button>
            {[3, 5, 10].map((count) => (
              <button
                key={count}
                className={minExamCount === count ? "active" : ""}
                onClick={() => setMinExamCount(count)}
                disabled={selectedData.selectedExamCount < count}
                title={selectedData.selectedExamCount < count ? `선택 범위에 등록된 시험이 ${selectedData.selectedExamCount}개입니다.` : ""}
              >
                {count}개 시험 이상
              </button>
            ))}
          </div>
          <small>선택 범위에 {selectedData.selectedExamCount}개 시험이 포함되어 있어요.</small>
        </div>

        {loading ? (
          <div className="empty-state">주제별 학습 목록을 준비하고 있어요.</div>
        ) : (
          <>
            <div className="topic-result-heading">
              <div>
                <h2>주제별 학습</h2>
                <p>비슷한 문제를 핵심 주제별로 모아, 필요한 개념부터 집중해서 학습할 수 있어요.</p>
              </div>
              <span>{filtered.length}개 주제</span>
            </div>

            <div className="topic-card-grid">
              {filtered.map((group) => (
                <article className="topic-study-card" key={`${group.subject}-${group.topic}`}>
                  <span className="topic-subject-label">{group.subject}</span>
                  <h3>{group.topic}</h3>
                  <p>
                    총 {group.questions.length.toLocaleString()}문제 · {group.examCount}개 시험에서 출제
                  </p>
                  {(() => {
                    const progress = topicProgress.get(`${group.subject}|||${group.topic}`) || { attempts: 0, correct: 0, questionIds: new Set() };
                    const uniqueAttempted = progress.questionIds?.size || 0;
                    const coverage = group.questions.length ? Math.min(100, Math.round((uniqueAttempted / group.questions.length) * 100)) : 0;
                    const accuracy = progress.attempts ? Math.round((progress.correct / progress.attempts) * 100) : null;
                    return <>
                      <div className="topic-progress"><i style={{ width: `${coverage}%` }} /></div>
                      <small>{progress.attempts ? `진행률 ${coverage}% · ${uniqueAttempted}문제 학습 · 누적 ${progress.attempts}회 풀이 · 정답률 ${accuracy}%` : `진행률 0% · 아직 학습 전`}</small>
                    </>;
                  })()}
                  <div className="topic-card-actions">
                    <button className="secondary" onClick={() => startGroup(group, "quick")}>20문제 빠른 학습</button>
                    <button className="primary" onClick={() => startGroup(group, "all")}>전체 학습</button>
                  </div>
                </article>
              ))}
            </div>

            {!filtered.length && (
              <div className="empty-state">
                조건에 맞는 주제가 없어요. 연도 범위나 출제 빈도를 조정해 보세요.
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
