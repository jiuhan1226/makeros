import { isPlaceholderTopic, normalizeQuestionTopic } from "./topicClassifier.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function simpleHash(value = "") {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function questionProgressId(question = {}) {
  if (question.id || question.questionId) return String(question.id || question.questionId);
  const source = [
    question.examId || question.sourceExamId || "exam",
    question.questionNumber || "q",
    question.question || "",
  ].join("|");
  return `generated-${simpleHash(source)}`;
}

export function getQuestionTags(question = {}) {
  const normalizedQuestion = normalizeQuestionTopic(question);
  const subject = String(normalizedQuestion.subject || "공통").trim() || "공통";
  const values = [
    normalizedQuestion.topic,
    ...(Array.isArray(normalizedQuestion.tags) ? normalizedQuestion.tags : []),
    normalizedQuestion.chapter,
    normalizedQuestion.unit,
    normalizedQuestion.category,
    normalizedQuestion.subTopic,
    normalizedQuestion.keyword,
  ];
  const normalized = values
    .map((value) => String(value || "").trim())
    .filter((value) => value && !isPlaceholderTopic(value) && value !== subject)
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, 8);
  return normalized.length ? normalized : [normalizedQuestion.topic];
}

export function resolveStudyScope(exam = {}, mode = "시험모드") {
  if (exam?.sourceType === "pdf") return "pdf";
  if (exam?.studyScope) return String(exam.studyScope);
  if (mode === "연습모드" || exam?.assessmentType === "practice") return "exam-practice";
  return "exam";
}

export function resolveLearningType(exam = {}, mode = "시험모드", explicitScope = "") {
  if (exam?.learningType) return String(exam.learningType);
  const scope = explicitScope || resolveStudyScope(exam, mode);
  const map = {
    exam: "exam",
    mock: "mock",
    subject: "subjectPractice",
    topic: "topicPractice",
    "due-review": "srsReview",
    "wrong-review": "repeatedWrong",
    recommended: "dailyRecommended",
    search: "examPractice",
    "exam-practice": "examPractice",
    pdf: "pdfPractice",
  };
  return map[scope] || (mode === "연습모드" ? "examPractice" : "exam");
}

export function isPracticeScope(scope) {
  return scope !== "exam" && scope !== "mock";
}

export function isExamHistoryRecord(item = {}) {
  const scope = String(item.studyScope || "");
  if (scope) return scope === "exam" || scope === "mock";
  if (item.assessmentType === "practice") return false;
  if (item.mode === "연습모드") return false;
  const id = String(item.examId || "");
  if (/^(subject|topic|recommended|wrong-review|search|pdf)-/.test(id)) return false;
  return item.mode === "시험모드" || item.mode === "실전모드" || item.assessmentType === "exam";
}

export function isTargetedPracticeRecord(item = {}) {
  return ["subject", "topic"].includes(String(item.studyScope || ""));
}

function dedupeSessions(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.sessionId || `${item.examId || item.title || "session"}:${item.createdAt || 0}:${item.total || 0}:${item.correct || 0}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function migrateLearningState(state = {}) {
  const rawHistory = Array.isArray(state.history) ? state.history : [];
  const existingPractice = Array.isArray(state.practiceHistory) ? state.practiceHistory : [];
  const history = dedupeSessions(rawHistory.filter(isExamHistoryRecord));
  const practiceHistory = dedupeSessions([
    ...existingPractice,
    ...rawHistory.filter((item) => !isExamHistoryRecord(item)),
  ]);

  // 과거 버전은 미응답 문제까지 오답으로 저장했으므로, 실제 선택값이 있는 문제만 유지합니다.
  const wrongNotes = (Array.isArray(state.wrongNotes) ? state.wrongNotes : [])
    .filter((item) => item?.selectedAnswerIndex !== undefined && item?.selectedAnswerIndex !== null);

  const learningProgress = (Array.isArray(state.learningProgress) ? state.learningProgress : []).map((item) => {
    const normalized = normalizeQuestionTopic(item);
    return {
      ...item,
      topic: normalized.topic,
      topicSource: normalized.topicSource,
      topicConfidence: normalized.topicConfidence,
      tags: normalized.tags,
    };
  });

  const attemptEvents = (Array.isArray(state.attemptEvents) ? state.attemptEvents : [])
    .filter((item) => item?.attemptId)
    .filter((item, index, values) => values.findIndex((row) => row.attemptId === item.attemptId) === index)
    .map((item) => ({
      ...item,
      learningType: item.learningType || resolveLearningType(item.exam || {}, item.mode, item.studyScope),
    }));

  return {
    ...state,
    history,
    practiceHistory,
    wrongNotes,
    learningProgress,
    attemptEvents,
  };
}

export function calculateNextReviewAt({ isCorrect, confidence, reviewLevel = 0, now = Date.now() }) {
  let days = 1;
  if (!isCorrect) days = confidence === "medium" ? 2 : 1;
  else if (confidence === "low") days = 1;
  else if (confidence === "medium") days = 3;
  else if (reviewLevel >= 3) days = 30;
  else if (reviewLevel >= 2) days = 14;
  else days = 7;
  return now + days * DAY_MS;
}

function nextReviewLevel(baseLevel, isCorrect, confidence) {
  if (!isCorrect || confidence === "low") return 0;
  if (isCorrect && confidence === "high") return baseLevel + 1;
  return baseLevel;
}

export function inferQuestionDifficulty(progress = {}) {
  const attempts = Number(progress.attemptCount || 0);
  if (attempts < 2) return { id: "pending", label: "분석 중", score: null };
  const accuracy = attempts ? (Number(progress.correctCount || 0) / attempts) * 100 : 0;
  if (Number(progress.wrongStreak || 0) >= 2 || accuracy <= 35) return { id: "hard", label: "어려움", score: Math.round(accuracy) };
  if (accuracy <= 70) return { id: "medium", label: "보통", score: Math.round(accuracy) };
  return { id: "easy", label: "쉬움", score: Math.round(accuracy) };
}

export function mergeLearningProgress(records = [], payload = {}) {
  const id = questionProgressId(payload.question || payload);
  const previous = records.find((item) => item.questionId === id) || {};
  const attemptId = String(payload.attemptId || `${Date.now()}:${id}`);
  const sameAttempt = previous.lastAttemptId === attemptId;
  const isCorrect = Boolean(payload.isCorrect);
  const confidence = ["high", "medium", "low"].includes(payload.confidence)
    ? payload.confidence
    : (isCorrect ? "medium" : "low");
  const now = Number(payload.now) || Date.now();

  const baseLevel = sameAttempt
    ? Number(previous.reviewLevelBeforeAttempt ?? previous.reviewLevel ?? 0)
    : Number(previous.reviewLevel || 0);
  const reviewLevel = nextReviewLevel(baseLevel, isCorrect, confidence);
  const attemptCount = Number(previous.attemptCount || 0) + (sameAttempt ? 0 : 1);
  const correctCount = Number(previous.correctCount || 0) + (!sameAttempt && isCorrect ? 1 : 0);
  const wrongCount = Number(previous.wrongCount || 0) + (!sameAttempt && !isCorrect ? 1 : 0);
  const wrongStreak = sameAttempt
    ? Number(previous.wrongStreak || 0)
    : (isCorrect ? 0 : Number(previous.wrongStreak || 0) + 1);
  const question = normalizeQuestionTopic(payload.question || payload);
  const studyScope = payload.studyScope || resolveStudyScope(payload.exam, payload.mode);
  const learningType = payload.learningType || resolveLearningType(payload.exam, payload.mode, studyScope);
  const dayKey = new Date(now).toISOString().slice(0, 10);
  const previousCorrectDays = Array.isArray(previous.correctDayKeys) ? previous.correctDayKeys : [];
  const correctDayKeys = isCorrect && !sameAttempt
    ? [...new Set([...previousCorrectDays, dayKey])].slice(-30)
    : previousCorrectDays;

  const next = {
    ...previous,
    questionId: id,
    examId: payload.exam?.id || question.examId || question.sourceExamId || previous.examId || "",
    certificateId: payload.exam?.certificateId || question.certificateId || previous.certificateId || "",
    certificateName: payload.exam?.certificateName || question.certificateName || previous.certificateName || "",
    subject: String(question.subject || previous.subject || "공통").trim() || "공통",
    topic: question.topic,
    topicSource: question.topicSource,
    topicConfidence: question.topicConfidence,
    tags: getQuestionTags(question),
    sourceExamId: question.sourceExamId || question.examId || previous.sourceExamId || "",
    examYear: Number(question.examYear || question.year || previous.examYear || 0) || "",
    studyScope,
    learningType,
    mode: payload.mode || previous.mode || "연습모드",
    attemptCount,
    correctCount,
    wrongCount,
    wrongStreak,
    correctDayKeys,
    distinctCorrectDays: correctDayKeys.length,
    lastReviewSuccess: isCorrect && ["srsReview", "repeatedWrong"].includes(learningType),
    lastAnswerIndex: Number(payload.selectedAnswerIndex),
    correctAnswerIndex: Number(question.answerIndex),
    isCorrect,
    confidence,
    reviewLevelBeforeAttempt: baseLevel,
    reviewLevel,
    nextReviewAt: calculateNextReviewAt({ isCorrect, confidence, reviewLevel, now }),
    lastSolvedAt: now,
    updatedAt: now,
    lastAttemptId: attemptId,
    question: question.question || previous.question || "",
    choices: question.choices || previous.choices || [],
    explanation: question.explanation || previous.explanation || "",
  };
  next.difficulty = inferQuestionDifficulty(next).id;

  const index = records.findIndex((item) => item.questionId === id);
  if (index < 0) return [next, ...records].slice(0, 5000);
  const copy = [...records];
  copy[index] = next;
  return copy;
}

export function mergeWrongAttempts(existing = [], wrongItems = []) {
  const map = new Map(existing.map((item) => [questionProgressId(item), { ...item }]));
  for (const item of wrongItems) {
    const id = questionProgressId(item);
    const previous = map.get(id) || {};
    const sameAttempt = previous.lastWrongAttemptId && previous.lastWrongAttemptId === item.attemptId;
    map.set(id, {
      ...previous,
      ...item,
      id: item.id || previous.id || id,
      questionId: id,
      wrongCount: Number(previous.wrongCount || 0) + (sameAttempt ? 0 : 1),
      firstWrongAt: previous.firstWrongAt || item.createdAt || Date.now(),
      lastWrongAt: item.createdAt || Date.now(),
      lastWrongAttemptId: item.attemptId || previous.lastWrongAttemptId || "",
    });
  }
  return [...map.values()]
    .sort((a, b) => Number(b.lastWrongAt || b.createdAt || 0) - Number(a.lastWrongAt || a.createdAt || 0))
    .slice(0, 1500);
}

export function getDueReviews(progress = [], now = Date.now()) {
  return progress
    .filter((item) => Number(item.nextReviewAt || 0) <= now)
    .sort((a, b) => Number(a.nextReviewAt || 0) - Number(b.nextReviewAt || 0));
}

export function buildRepeatedWrong(progress = [], minimum = 2) {
  return progress
    .filter((item) => Number(item.wrongCount || 0) >= minimum)
    .sort((a, b) => Number(b.wrongCount || 0) - Number(a.wrongCount || 0) || Number(b.lastSolvedAt || 0) - Number(a.lastSolvedAt || 0));
}

export function buildWeakConcepts(progress = [], limit = 8, options = {}) {
  const map = new Map();
  const topicByQuestionId = options?.topicByQuestionId;

  for (const item of progress) {
    const normalizedItem = normalizeQuestionTopic(item);
    const questionId = questionProgressId(item);
    const resolvedTopic = topicByQuestionId instanceof Map
      ? topicByQuestionId.get(questionId)
      : topicByQuestionId?.[questionId];
    const topic = String(resolvedTopic || normalizedItem.topic || "").trim();
    if (!topic || isPlaceholderTopic(topic)) continue;

    const current = map.get(topic) || {
      tag: topic,
      attempts: 0,
      correct: 0,
      wrong: 0,
      lowConfidence: 0,
      questionIds: new Set(),
    };
    current.attempts += Number(item.attemptCount || 0);
    current.correct += Number(item.correctCount || 0);
    current.wrong += Number(item.wrongCount || 0);
    current.lowConfidence += item.confidence === "low" ? 1 : item.confidence === "medium" ? 0.5 : 0;
    current.questionIds.add(questionId);
    map.set(topic, current);
  }

  return [...map.values()]
    .map((item) => {
      const accuracy = item.attempts ? Math.round((item.correct / item.attempts) * 100) : 0;
      const mastery = clamp(accuracy - item.lowConfidence * 6, 0, 100);
      return {
        ...item,
        questionCount: item.questionIds.size,
        accuracy,
        mastery,
        risk: clamp(100 - mastery + item.wrong * 2, 0, 100),
      };
    })
    .sort((a, b) => b.risk - a.risk || b.attempts - a.attempts)
    .slice(0, limit)
    .map(({ questionIds, ...item }) => item);
}

export function estimatePassProjection(history = [], passScore = 60) {
  const recent = history.filter(isExamHistoryRecord).slice(0, 8);
  if (!recent.length) return { probability: null, expectedScore: null, trend: 0, sampleSize: 0, label: "데이터 부족" };
  const scores = recent.map((item) => clamp(item.score));
  const weights = scores.map((_, index) => scores.length - index);
  const weighted = scores.reduce((sum, score, index) => sum + score * weights[index], 0) / weights.reduce((sum, value) => sum + value, 0);
  const trend = scores.length >= 2 ? scores[0] - scores.at(-1) : 0;
  const expectedScore = clamp(Math.round(weighted + trend * 0.25));
  const rawProbability = 100 / (1 + Math.exp(-(expectedScore - Number(passScore || 60)) / 6.5));
  const confidence = Math.min(1, recent.length / 5);
  const probability = Math.round(50 + (rawProbability - 50) * confidence);
  const label = probability >= 80 ? "합격권" : probability >= 60 ? "가능성 있음" : probability >= 40 ? "경계 구간" : "보완 필요";
  return { probability: clamp(probability), expectedScore, trend, sampleSize: recent.length, label };
}

function median(values = []) {
  const sorted = values.map(Number).filter((value) => value > 0).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function masteryStageForProgress(item = {}) {
  const attempts = Math.max(0, Number(item.attemptCount || 0));
  const correct = Math.max(0, Number(item.correctCount || 0));
  const distinctCorrectDays = Math.max(
    Number(item.distinctCorrectDays || 0),
    Array.isArray(item.correctDayKeys) ? item.correctDayKeys.length : 0,
  );
  const confidence = item.confidence || "low";
  const lastSuccess = Boolean(item.isCorrect);
  const reviewSuccess = Boolean(item.lastReviewSuccess) || Number(item.reviewLevel || 0) >= 2;

  if (!attempts) return { id: "unseen", label: "미풀이", weight: 0 };
  if (
    correct >= 2
    && distinctCorrectDays >= 2
    && confidence === "high"
    && lastSuccess
    && reviewSuccess
  ) return { id: "mastered", label: "마스터", weight: 1 };
  if (correct >= 2 && distinctCorrectDays >= 2 && lastSuccess) {
    return { id: "proficient", label: "숙련", weight: 0.8 };
  }
  if (correct >= 1 || Number(item.reviewLevel || 0) >= 1) {
    return { id: "understanding", label: "이해 중", weight: 0.5 };
  }
  return { id: "answered", label: "풀이 완료", weight: 0.2 };
}

function masteryForProgress(item = {}) {
  const stage = masteryStageForProgress(item);
  const attempts = Math.max(0, Number(item.attemptCount || 0));
  if (!attempts) return 0;
  const accuracy = clamp((Number(item.correctCount || 0) / attempts) * 100);
  const confidence = item.confidence === "high" ? 100 : item.confidence === "medium" ? 68 : 35;
  const wrongPenalty = Math.min(18, Number(item.wrongStreak || 0) * 6);
  const blended = stage.weight * 72 + accuracy * 0.18 + confidence * 0.1 - wrongPenalty;
  return clamp(blended);
}

function resolveSourceExamId(item = {}, examIds = []) {
  const explicit = String(item.sourceExamId || "").trim();
  if (explicit) return explicit;
  const direct = String(item.examId || "").trim();
  if (examIds.includes(direct)) return direct;
  const questionId = String(item.questionId || item.id || "");
  return [...examIds]
    .sort((a, b) => b.length - a.length)
    .find((id) => questionId === id || questionId.startsWith(`${id}_`)) || "";
}

function countPlannedStudyDays(examDate, studyDays = []) {
  if (!examDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${examDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const allowed = Array.isArray(studyDays) && studyDays.length ? new Set(studyDays.map(Number)) : null;
  let count = 0;
  const cursor = new Date(today);
  for (let guard = 0; cursor < target && guard < 730; guard += 1) {
    if (!allowed || allowed.has(cursor.getDay())) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function buildExamReadiness({
  progress = [],
  history = [],
  exams = [],
  questionCatalog = [],
  plan = {},
  passScore = 60,
  recommendedExamSessions = 12,
} = {}) {
  const examIds = [...new Set(exams.map((exam) => String(exam?.id || "").trim()).filter(Boolean))];
  const catalogByExam = new Map();
  for (const question of questionCatalog) {
    const sourceExamId = String(question.sourceExamId || question.examId || "").trim();
    if (sourceExamId) catalogByExam.set(sourceExamId, (catalogByExam.get(sourceExamId) || 0) + 1);
  }
  const examQuestionCounts = [
    ...exams.map((exam) => Number(exam?.questionCount || 0)),
    ...catalogByExam.values(),
  ].filter((value) => value > 0);
  const questionsPerExam = median(examQuestionCounts) || 60;
  const availableSessions = Math.max(examIds.length, catalogByExam.size);
  const effectiveTargetSessions = Math.max(1, Math.min(recommendedExamSessions, availableSessions || recommendedExamSessions));
  const catalogQuestionCount = new Set(questionCatalog.map((question) => questionProgressId(question))).size;
  const targetQuestionCount = catalogQuestionCount
    ? Math.min(catalogQuestionCount, questionsPerExam * effectiveTargetSessions)
    : questionsPerExam * effectiveTargetSessions;

  const relevantProgress = progress
    .filter((item) => item?.studyScope !== "pdf")
    .filter((item, index, values) => values.findIndex((row) => questionProgressId(row) === questionProgressId(item)) === index);
  const attemptedQuestionCount = relevantProgress.length;
  const masteryScores = relevantProgress.map(masteryForProgress);
  const rawMasteryScore = masteryScores.length
    ? Math.round(masteryScores.reduce((sum, value) => sum + value, 0) / masteryScores.length)
    : 0;
  const masteryStageCounts = relevantProgress.reduce((result, item) => {
    const stage = masteryStageForProgress(item).id;
    result[stage] = (result[stage] || 0) + 1;
    return result;
  }, { unseen: 0, answered: 0, understanding: 0, proficient: 0, mastered: 0 });
  const masteredQuestionCount = masteryStageCounts.mastered;
  const proficientOrBetterCount = masteryStageCounts.proficient + masteryStageCounts.mastered;

  const coveredExamIds = new Set();
  for (const item of relevantProgress) {
    const sourceExamId = resolveSourceExamId(item, examIds);
    if (sourceExamId) coveredExamIds.add(sourceExamId);
  }
  for (const item of history.filter(isExamHistoryRecord)) {
    const examId = String(item.examId || "").trim();
    if (examId && (!examIds.length || examIds.includes(examId))) coveredExamIds.add(examId);
  }
  const coveredSessions = Math.min(effectiveTargetSessions, coveredExamIds.size);

  const coverageScore = targetQuestionCount ? clamp((attemptedQuestionCount / targetQuestionCount) * 100) : 0;
  const sessionScore = clamp((coveredSessions / effectiveTargetSessions) * 100);
  const evidenceTarget = Math.max(questionsPerExam * 3, 60);
  const evidenceFactor = clamp(attemptedQuestionCount / evidenceTarget, 0, 1);
  const masteryScore = Math.round(rawMasteryScore * evidenceFactor);
  const projection = estimatePassProjection(history, passScore);
  const validationScore = projection.expectedScore === null
    ? Math.round(masteryScore * 0.65)
    : Math.round(clamp(((projection.expectedScore - (Number(passScore) - 20)) / 40) * 100));

  const componentPoints = {
    coverage: Math.round((coverageScore / 100) * 35),
    sessions: Math.round((sessionScore / 100) * 25),
    mastery: Math.round((masteryScore / 100) * 25),
    validation: Math.round((validationScore / 100) * 15),
  };
  const readinessScore = Math.round(clamp(
    componentPoints.coverage
      + componentPoints.sessions
      + componentPoints.mastery
      + componentPoints.validation,
  ));
  const stage = readinessScore >= 85
    ? "마스터 단계"
    : readinessScore >= 70
      ? "합격권 준비"
      : readinessScore >= 50
        ? "기출 반복 단계"
        : readinessScore >= 30
          ? "기초 확장 단계"
          : "학습 시작 단계";

  const due = getDueReviews(relevantProgress);
  const repeated = buildRepeatedWrong(relevantProgress);
  const remainingNewQuestions = Math.max(0, targetQuestionCount - attemptedQuestionCount);
  const remainingMasteryQuestions = Math.max(0, attemptedQuestionCount - proficientOrBetterCount);
  const reviewWorkload = Math.max(remainingMasteryQuestions, due.length + repeated.length);
  const remainingWorkload = remainingNewQuestions + Math.ceil(reviewWorkload * 0.65);
  const plannedStudyDays = countPlannedStudyDays(plan.examDate, plan.studyDays);
  const calculationDays = plannedStudyDays === null ? 90 : Math.max(1, plannedStudyDays);
  const finalReviewDays = calculationDays >= 21 ? Math.min(7, Math.max(3, Math.ceil(calculationDays * 0.15))) : calculationDays >= 10 ? 2 : 0;
  const coverageStudyDays = Math.max(1, calculationDays - finalReviewDays);
  let recommendedDailyQuestions = remainingWorkload
    ? Math.ceil(remainingWorkload / coverageStudyDays)
    : Math.max(10, Math.min(20, due.length + repeated.length || 10));
  recommendedDailyQuestions = Math.max(10, recommendedDailyQuestions);
  if (plannedStudyDays !== null && plannedStudyDays <= 7 && readinessScore < 80) {
    recommendedDailyQuestions = Math.max(recommendedDailyQuestions, Math.min(questionsPerExam, 60));
  }
  recommendedDailyQuestions = Math.min(Math.max(20, questionsPerExam * 2), recommendedDailyQuestions);

  const dueGoal = Math.min(due.length, Math.round(recommendedDailyQuestions * 0.25));
  const dueIds = new Set(due.map((item) => item.questionId));
  const repeatedOnly = repeated.filter((item) => !dueIds.has(item.questionId));
  const repeatedGoal = Math.min(repeatedOnly.length, Math.round(recommendedDailyQuestions * 0.2));
  const newGoal = Math.max(0, recommendedDailyQuestions - dueGoal - repeatedGoal);

  return {
    readinessScore,
    stage,
    recommendedExamSessions,
    effectiveTargetSessions,
    availableSessions,
    coveredSessions,
    sessionGap: Math.max(0, recommendedExamSessions - coveredSessions),
    questionsPerExam,
    targetQuestionCount,
    attemptedQuestionCount,
    masteredQuestionCount,
    proficientOrBetterCount,
    masteryStageCounts,
    components: [
      { id: "coverage", label: "기출 범위 학습", score: componentPoints.coverage, max: 35, percentage: Math.round(coverageScore), detail: `${attemptedQuestionCount}/${targetQuestionCount}문제 학습` },
      { id: "sessions", label: "기출 회차 확보", score: componentPoints.sessions, max: 25, percentage: Math.round(sessionScore), detail: `${coveredSessions}/${effectiveTargetSessions}회차 학습` },
      { id: "mastery", label: "문제 숙련도", score: componentPoints.mastery, max: 25, percentage: masteryScore, detail: `숙련 이상 ${proficientOrBetterCount}문제 · 마스터 ${masteredQuestionCount}문제` },
      { id: "validation", label: "실전 점수 검증", score: componentPoints.validation, max: 15, percentage: validationScore, detail: projection.expectedScore === null ? "실전 시험 기록 필요" : `예상 ${projection.expectedScore}점 · ${projection.sampleSize}회 반영` },
    ],
    remainingNewQuestions,
    remainingMasteryQuestions,
    remainingWorkload,
    coverageScore: Math.round(coverageScore),
    sessionScore: Math.round(sessionScore),
    rawMasteryScore,
    masteryScore,
    validationScore,
    projection,
    plannedStudyDays,
    finalReviewDays,
    recommendedDailyQuestions,
    allocation: {
      newQuestions: newGoal,
      dueReviews: dueGoal,
      repeatedWrong: repeatedGoal,
    },
    catalogLimited: availableSessions > 0 && availableSessions < recommendedExamSessions,
  };
}

export function buildTodayStudyPlan({ progress = [], wrongNotes = [], practiceHistory = [], plan = {}, pdfLibrary = [], readiness = null, topicByQuestionId = null } = {}) {
  const due = getDueReviews(progress);
  const dueIds = new Set(due.map((item) => item.questionId));
  const repeated = buildRepeatedWrong(progress);
  const repeatedOnly = repeated.filter((item) => !dueIds.has(item.questionId));
  const weak = buildWeakConcepts(progress, 3, { topicByQuestionId });
  const requiredGoal = Math.max(10, Number(readiness?.recommendedDailyQuestions) || 0);
  const cutoff = Date.now() - 7 * DAY_MS;
  const recentSessions = practiceHistory.filter((item) => Number(item.createdAt || 0) >= cutoff);
  const recentDays = new Set(recentSessions.map((item) => new Date(Number(item.createdAt || 0)).toISOString().slice(0, 10)));
  const recentQuestionCount = recentSessions.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const recentDailyAverage = recentDays.size ? Math.round(recentQuestionCount / recentDays.size) : 0;
  const adaptiveGoal = recentDailyAverage
    ? Math.max(10, Math.min(requiredGoal, Math.ceil(recentDailyAverage * 1.3 + 5)))
    : Math.min(requiredGoal || 30, 30);
  const recommendedGoal = Number(plan.dailyGoal) || adaptiveGoal || requiredGoal || 30;
  const dailyGoal = Math.max(10, recommendedGoal);
  const pdfGoal = Math.max(0, Math.min(Number(plan.pdfGoal) || 0, Math.floor(dailyGoal * 0.25)));
  const srsGoal = Math.min(due.length, Number(readiness?.allocation?.dueReviews) || Math.round(dailyGoal * 0.25));
  const repeatedGoal = Math.min(repeatedOnly.length, Number(readiness?.allocation?.repeatedWrong) || Math.round(dailyGoal * 0.2));
  const cbtGoal = Math.max(5, dailyGoal - pdfGoal - srsGoal - repeatedGoal);
  const tasks = [
    {
      id: "srs",
      title: "자동 복습",
      count: srsGoal,
      detail: due.length ? "복습 예정일이 지난 문제" : "오늘 복습할 문제가 없습니다.",
      enabled: due.length > 0,
      reasons: ["오늘 이전으로 복습 예정일이 설정된 문제", "기억 간격을 다시 맞추기 위한 SRS 우선 학습"],
    },
    {
      id: "repeated",
      title: "반복 오답",
      count: repeatedGoal,
      detail: repeatedOnly.length ? "자동 복습과 겹치지 않는 2회 이상 오답" : "추가 반복 오답이 없습니다.",
      enabled: repeatedOnly.length > 0,
      reasons: ["2회 이상 틀린 문제", "자동 복습 목록과 겹치는 문제는 중복 제외"],
    },
    {
      id: "weak",
      title: weak[0]?.tag || "기출 범위 확장",
      count: cbtGoal,
      detail: weak[0]
        ? `숙련도 ${weak[0].mastery}%인 개념과 아직 풀지 않은 기출을 함께 학습`
        : "3~4개년도, 약 12회차의 기출 범위를 채우는 학습",
      enabled: true,
      reasons: weak[0]
        ? [`${weak[0].tag} 숙련도 ${weak[0].mastery}%`, `누적 오답 ${weak[0].wrong}회`, "아직 풀지 않은 기출 범위와 함께 구성"]
        : ["3~4개년도 약 12회차 목표 범위 확장", "미풀이 기출 우선"],
    },
    {
      id: "pdf",
      title: pdfLibrary[0]?.name || "PDF 학습",
      count: pdfGoal,
      detail: pdfGoal ? "AI 노트·단어카드 복습" : "PDF 목표가 설정되지 않았습니다.",
      enabled: pdfGoal > 0 && pdfLibrary.length > 0,
      reasons: ["사용자가 설정한 PDF 학습 목표", "CBT와 별도 학습량으로 관리"],
    },
  ];
  return {
    due,
    repeated,
    repeatedOnly,
    weak,
    dailyGoal,
    requiredDailyGoal: requiredGoal,
    recommendedDailyGoal: recommendedGoal || dailyGoal,
    recentDailyAverage,
    recommendationGap: Math.max(0, requiredGoal - dailyGoal),
    tasks,
    practiceSessions: practiceHistory.length,
    wrongCount: wrongNotes.length,
  };
}

export function dDayAnalysis(plan = {}, readiness = {}) {
  const requiredDailyQuestions = Number(readiness?.recommendedDailyQuestions) || null;
  if (!plan.examDate) {
    return {
      dday: null,
      requiredDailyQuestions,
      studyDays: null,
      status: requiredDailyQuestions ? "시험일 미설정 · 90일 완성 기준" : "시험일 미설정",
    };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${plan.examDate}T00:00:00`);
  const dday = Math.ceil((target - today) / DAY_MS);
  const dailyGoal = Math.max(1, Number(plan.dailyGoal) || 30);
  const studyDays = readiness?.plannedStudyDays ?? countPlannedStudyDays(plan.examDate, plan.studyDays);
  const status = dday < 0
    ? "시험일 경과"
    : requiredDailyQuestions === null
      ? "학습 데이터 계산 중"
      : requiredDailyQuestions <= dailyGoal
        ? "현재 목표로 기출 마스터 가능"
        : `하루 ${requiredDailyQuestions}문제로 상향 권장`;
  return { dday, requiredDailyQuestions, studyDays, status };
}

export function difficultySummary(progress = []) {
  const result = { hard: 0, medium: 0, easy: 0, pending: 0 };
  for (const item of progress) result[inferQuestionDifficulty(item).id] += 1;
  return result;
}
