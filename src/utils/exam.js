export const circled = ["①", "②", "③", "④", "⑤"];

export function formatTime(seconds = 0) {
  const safe = Math.max(0, Number(seconds) || 0);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function examYears(exams) {
  return [...new Set(exams.map((exam) => Number(exam.year)).filter(Boolean))].sort((a, b) => b - a);
}

export function examDateValue(exam) {
  return String(exam?.examDate || "").trim();
}

export function examDateLabel(exam) {
  const raw = examDateValue(exam);
  if (raw) {
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return `${Number(match[2])}월 ${Number(match[3])}일`;
    return raw;
  }
  return String(exam?.round || exam?.title || "시험일 미입력");
}

export function officialQuestionCount(exams) {
  const counts = exams.map((exam) => Number(exam.questionCount)).filter((value) => value > 0);
  return counts.length ? Math.max(...counts) : 60;
}

export function mockCountOptions(exams) {
  const full = officialQuestionCount(exams);
  const base = [20, 40, 60, 100].filter((value) => value <= full);
  if (!base.includes(full)) base.push(full);
  return [...new Set(base)].sort((a, b) => a - b);
}

export function countSubjects(questions) {
  const counts = new Map();
  questions.forEach((question) => {
    const subject = String(question?.subject || "공통").trim() || "공통";
    counts.set(subject, (counts.get(subject) || 0) + 1);
  });
  return counts;
}

export function buildSubjectQuota(referenceQuestions, requestedCount) {
  const subjectCounts = [...countSubjects(referenceQuestions).entries()];
  if (!subjectCounts.length) return [];

  const referenceTotal = subjectCounts.reduce((sum, [, value]) => sum + value, 0);
  const raw = subjectCounts.map(([subject, sourceCount], order) => {
    const exact = (sourceCount / referenceTotal) * requestedCount;
    return { subject, sourceCount, exact, count: Math.floor(exact), remainder: exact - Math.floor(exact), order };
  });

  let assigned = raw.reduce((sum, item) => sum + item.count, 0);
  const remainderOrder = [...raw].sort((a, b) => b.remainder - a.remainder || b.sourceCount - a.sourceCount || a.order - b.order);
  for (let i = 0; assigned < requestedCount; i += 1, assigned += 1) remainderOrder[i % remainderOrder.length].count += 1;
  return raw.sort((a, b) => a.order - b.order);
}

export function selectBalancedQuestions(questionBatches, requestedCount) {
  const usable = questionBatches.filter((batch) => Array.isArray(batch.questions) && batch.questions.length);
  if (!usable.length) throw new Error("선택한 시험에서 문제를 불러오지 못했습니다.");

  // 가장 완전한 한 회차의 과목 구성을 실제 시험 출제 비율의 기준으로 사용합니다.
  const reference = [...usable].sort((a, b) => b.questions.length - a.questions.length)[0].questions;
  const quota = buildSubjectQuota(reference, requestedCount);
  const allQuestions = usable.flatMap((batch) => batch.questions.map((question) => ({ ...question, sourceExamId: batch.exam.id })));
  const bySubject = new Map();

  allQuestions.forEach((question) => {
    const subject = String(question?.subject || "공통").trim() || "공통";
    if (!bySubject.has(subject)) bySubject.set(subject, []);
    bySubject.get(subject).push(question);
  });

  const selected = [];
  for (const item of quota) {
    const pool = shuffle(bySubject.get(item.subject) || []);
    if (pool.length < item.count) {
      throw new Error(`${item.subject} 파트는 ${item.count}문제가 필요하지만 선택한 시험일에는 ${pool.length}문제만 있습니다.`);
    }
    selected.push(...pool.slice(0, item.count));
  }

  // 실제 시험처럼 파트 순서를 유지하고, 각 파트 내부에서만 문제 순서를 무작위화합니다.
  return { questions: selected, quota };
}


export function hasSubjectCutoff(exam) {
  if (typeof exam?.hasSubjectCutoff === "boolean") return exam.hasSubjectCutoff;
  const grade = String(exam?.grade || exam?.certificateGrade || exam?.title || "");
  return /(산업기사|기사|기능장|기술사)/.test(grade);
}

export function gradeExam(questions, answers, exam = {}, mode = "실전모드") {
  const allItems = questions.map((question, index) => ({
    question,
    index,
    answer: answers[index],
    answered: answers[index] !== undefined,
  }));
  const isPracticeMode = mode === "연습모드" || exam?.assessmentType === "practice";
  const gradingItems = isPracticeMode ? allItems.filter((item) => item.answered) : allItems;
  const total = gradingItems.length;
  const correct = gradingItems.reduce(
    (sum, item) => sum + (Number(item.answer) === Number(item.question.answerIndex) ? 1 : 0),
    0,
  );
  const wrong = Math.max(0, total - correct);
  const score = total ? Math.round((correct / total) * 100) : 0;
  const subjectMap = new Map();

  gradingItems.forEach(({ question, answer }) => {
    const subject = String(question?.subject || "공통").trim() || "공통";
    const current = subjectMap.get(subject) || { subject, total: 0, correct: 0, wrong: 0, score: 0 };
    current.total += 1;
    if (Number(answer) === Number(question.answerIndex)) current.correct += 1;
    else current.wrong += 1;
    subjectMap.set(subject, current);
  });

  const subjects = [...subjectMap.values()].map((item) => ({
    ...item,
    score: item.total ? Math.round((item.correct / item.total) * 100) : 0,
  }));

  const assessmentType = isPracticeMode ? "practice" : "exam";
  const cutoffEnabled = assessmentType === "exam" && hasSubjectCutoff(exam);
  const cutoffScore = Number(exam?.subjectCutoffScore ?? 40);
  const passScore = Number(exam?.passScore ?? 60);
  const failedSubjects = cutoffEnabled ? subjects.filter((item) => item.score < cutoffScore) : [];
  const passed = assessmentType === "exam" ? score >= passScore && failedSubjects.length === 0 : null;

  return {
    total,
    correct,
    wrong,
    score,
    answered: allItems.filter((item) => item.answered).length,
    unanswered: allItems.filter((item) => !item.answered).length,
    subjects,
    assessmentType,
    cutoffEnabled,
    cutoffScore,
    passScore,
    failedSubjects,
    passed,
    resultLabel: assessmentType === "practice" ? "학습 완료" : passed ? "합격" : failedSubjects.length ? "과락 불합격" : "불합격",
  };
}

export function buildWrongNoteAnalysis(wrongNotes = [], history = []) {
  if (!wrongNotes.length) {
    return {
      headline: "아직 분석할 오답이 없습니다.",
      summary: "시험이나 연습문제를 풀면 과목별 취약점과 반복 오답 유형을 분석합니다.",
      weakSubjects: [],
      recommendations: [],
    };
  }

  const subjectMap = new Map();
  wrongNotes.forEach((item) => {
    const subject = String(item.subject || "공통").trim() || "공통";
    const current = subjectMap.get(subject) || { subject, wrongCount: 0, questions: [], recentWrongCount: 0 };
    const count = Math.max(1, Number(item.wrongCount || 1));
    current.wrongCount += count;
    current.questions.push(item);
    if (!item.createdAt || Date.now() - Number(item.createdAt) < 1000 * 60 * 60 * 24 * 14) current.recentWrongCount += count;
    subjectMap.set(subject, current);
  });

  const weakSubjects = [...subjectMap.values()]
    .sort((a, b) => b.wrongCount - a.wrongCount || b.recentWrongCount - a.recentWrongCount)
    .slice(0, 5)
    .map((item) => ({
      subject: item.subject,
      wrongCount: item.wrongCount,
      recentWrongCount: item.recentWrongCount,
      sampleQuestions: item.questions.slice(0, 3).map((q) => q.question),
    }));

  const top = weakSubjects[0];
  const recentScores = history.slice(0, 5).map((item) => Number(item.score)).filter(Number.isFinite);
  const trend = recentScores.length >= 2 ? recentScores[0] - recentScores[recentScores.length - 1] : 0;
  const trendText = trend >= 5 ? "최근 성적은 상승 중입니다." : trend <= -5 ? "최근 성적이 내려가고 있어 오답 재학습이 필요합니다." : "최근 성적은 비슷한 수준을 유지하고 있습니다.";

  return {
    headline: `${top.subject}에서 오답이 가장 많이 발생했습니다.`,
    summary: `저장된 오답 ${wrongNotes.length}문제를 분석했습니다. ${trendText}`,
    weakSubjects,
    recommendations: weakSubjects.slice(0, 3).map((item, index) => ({
      title: `${item.subject} 취약문제 복습`,
      detail: `${item.wrongCount}개의 오답 중 최근 오답 ${item.recentWrongCount}개를 우선 복습하세요.`,
      count: Math.min(20, Math.max(5, item.wrongCount)),
      priority: index + 1,
    })),
  };
}
