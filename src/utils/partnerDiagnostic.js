import { getQuestionTags, questionProgressId } from "./learningEngine.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function weightedSessionScore(sessions = []) {
  const totals = sessions.reduce((result, item) => ({
    total: result.total + Math.max(0, Number(item?.total || 0)),
    correct: result.correct + Math.max(0, Number(item?.correct || 0)),
  }), { total: 0, correct: 0 });
  return totals.total ? Math.round((totals.correct / totals.total) * 100) : null;
}

export function buildDiagnosticProfile({ questions = [], progress = [], history = [], practiceHistory = [] } = {}) {
  const progressRows = progress.filter((item) => Number(item?.attemptCount || 0) > 0);
  const attemptCount = progressRows.reduce((sum, item) => sum + Number(item.attemptCount || 0), 0);
  const correctCount = progressRows.reduce((sum, item) => sum + Number(item.correctCount || 0), 0);
  const progressAccuracy = attemptCount ? Math.round((correctCount / attemptCount) * 100) : null;
  const recentSessions = [...history, ...practiceHistory].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  const accuracy = progressAccuracy ?? weightedSessionScore(recentSessions) ?? 0;
  const attemptedIds = new Set(progressRows.map((item) => String(item.questionId || "")));
  const coverage = questions.length ? Math.round((attemptedIds.size / questions.length) * 100) : 0;
  const subjectMap = new Map();

  for (const item of progressRows) {
    const subject = String(item.subject || "공통").trim() || "공통";
    const current = subjectMap.get(subject) || { subject, attempts: 0, correct: 0, wrong: 0 };
    current.attempts += Number(item.attemptCount || 0);
    current.correct += Number(item.correctCount || 0);
    current.wrong += Number(item.wrongCount || 0);
    subjectMap.set(subject, current);
  }
  for (const session of recentSessions) {
    for (const row of session.subjects || []) {
      if (subjectMap.has(row.subject)) continue;
      subjectMap.set(row.subject, {
        subject: row.subject,
        attempts: Number(row.total || 0),
        correct: Number(row.correct || 0),
        wrong: Number(row.wrong || 0),
      });
    }
  }

  const subjectStats = [...subjectMap.values()].map((item) => ({
    ...item,
    accuracy: item.attempts ? Math.round((item.correct / item.attempts) * 100) : 0,
  })).sort((a, b) => a.accuracy - b.accuracy || b.wrong - a.wrong || b.attempts - a.attempts);
  const weakSubjects = subjectStats.slice(0, 3).map((item) => item.subject);
  const stage = attemptCount < 10
    ? "진단 데이터 부족"
    : accuracy >= 80
      ? "심화 문제 도전"
      : accuracy >= 60
        ? "합격권 안정화"
        : "기초 개념 보완";
  const difficulty = accuracy >= 80 ? "어려움" : accuracy >= 60 ? "보통" : "기초";

  return {
    attemptCount,
    sessionCount: recentSessions.length,
    accuracy,
    coverage,
    stage,
    difficulty,
    weakSubjects,
    subjectStats,
    hasReliableHistory: attemptCount >= 10 || recentSessions.length >= 1,
  };
}

function priorityForQuestion(question, progressById, weakSubjects) {
  const progress = progressById.get(questionProgressId(question));
  const subjectIndex = weakSubjects.indexOf(String(question.subject || "공통"));
  const weakPriority = subjectIndex >= 0 ? (weakSubjects.length - subjectIndex) * 30 : 0;
  const unseenPriority = progress ? 0 : 45;
  const wrongPriority = Number(progress?.wrongCount || 0) * 18;
  const lowAccuracyPriority = progress?.attemptCount
    ? Math.round((1 - Number(progress.correctCount || 0) / Number(progress.attemptCount)) * 25)
    : 0;
  return weakPriority + unseenPriority + wrongPriority + lowAccuracyPriority;
}

export function selectDiagnosticReferences({ questions = [], progress = [], weakSubjects = [], limit = 36, focusWeak = false } = {}) {
  const progressById = new Map(progress.map((item) => [String(item.questionId || ""), item]));
  const allNormalized = questions
    .filter((question) => question?.question && Array.isArray(question.choices) && question.choices.length >= 2 && Number.isInteger(Number(question.answerIndex)))
    .map((question) => ({
      ...question,
      _priority: priorityForQuestion(question, progressById, weakSubjects),
      _subject: String(question.subject || "공통").trim() || "공통",
    }));
  const focused = allNormalized.filter((question) => !focusWeak || !weakSubjects.length || weakSubjects.includes(question._subject));
  const normalized = focused.length >= 4 ? focused : allNormalized;

  const buckets = new Map();
  for (const question of normalized.sort((a, b) => b._priority - a._priority)) {
    if (!buckets.has(question._subject)) buckets.set(question._subject, []);
    buckets.get(question._subject).push(question);
  }
  const orderedSubjects = [...buckets.keys()].sort((a, b) => {
    const ai = weakSubjects.indexOf(a);
    const bi = weakSubjects.indexOf(b);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  const selected = [];
  let cursor = 0;
  while (selected.length < limit && orderedSubjects.some((subject) => buckets.get(subject)?.length)) {
    const subject = orderedSubjects[cursor % Math.max(1, orderedSubjects.length)];
    const next = buckets.get(subject)?.shift();
    if (next) selected.push(next);
    cursor += 1;
  }
  return selected.map(({ _priority, _subject, ...question }) => question);
}

export function diagnosticReferencePayload(questions = []) {
  return questions.map((question, index) => ({
    id: String(question.id || questionProgressId(question) || `reference-${index + 1}`),
    subject: String(question.subject || "공통").slice(0, 80),
    topic: String(getQuestionTags(question)[0] || question.topic || "").slice(0, 80),
    question: String(question.question || "").slice(0, 600),
    choices: question.choices.slice(0, 5).map((choice) => String(choice).slice(0, 300)),
    answerIndex: clamp(Number(question.answerIndex), 0, question.choices.length - 1),
    explanation: String(question.explanation || "").slice(0, 800),
  }));
}

export function normalizeGeneratedDiagnostic(questions = [], certificate = {}) {
  return questions
    .filter((question) => question?.question && Array.isArray(question.choices) && question.choices.length >= 2)
    .map((question, index) => ({
      ...question,
      id: `ai-diagnostic-${Date.now()}-${index + 1}`,
      questionNumber: index + 1,
      subject: String(question.subject || "공통").trim() || "공통",
      topic: String(question.topic || "").trim(),
      choices: question.choices.map(String),
      answerIndex: Number(question.answerIndex),
      explanation: String(question.explanation || "").trim(),
      sourceType: "ai-generated-cbt",
      aiGenerated: true,
      certificateId: certificate?.id || "",
      certificateName: certificate?.name || "",
    }))
    .filter((question) => Number.isInteger(question.answerIndex) && question.answerIndex >= 0 && question.answerIndex < question.choices.length);
}

export function buildFallbackDiagnostic(questions = [], certificate = {}, count = 15) {
  return questions.slice(0, count).map((question, index) => ({
    ...question,
    id: `diagnostic-fallback-${question.id || index + 1}-${Date.now()}`,
    questionNumber: index + 1,
    sourceType: "cbt-reference",
    certificateId: certificate?.id || question.certificateId || "",
    certificateName: certificate?.name || question.certificateName || "",
  }));
}
