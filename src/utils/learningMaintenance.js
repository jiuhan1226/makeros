import {
  mergeLearningProgress,
  mergeWrongAttempts,
  questionProgressId,
  resolveLearningType,
  resolveStudyScope,
} from "./learningEngine.js";
import { normalizeQuestionTopic } from "./topicClassifier.js";

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function createAttemptEvent(payload = {}) {
  const question = normalizeQuestionTopic(payload.question || payload);
  const exam = payload.exam || {};
  const studyScope = payload.studyScope || resolveStudyScope(exam, payload.mode);
  const learningType = payload.learningType || resolveLearningType(exam, payload.mode, studyScope);
  const questionId = questionProgressId(question);
  const attemptId = String(payload.attemptId || `${Date.now()}:${questionId}`);
  const answeredAt = safeNumber(payload.answeredAt || payload.now || Date.now(), Date.now());

  return {
    attemptId,
    sessionId: String(payload.sessionId || attemptId.split(":")[0] || ""),
    questionId,
    examId: String(exam.id || question.examId || ""),
    sourceExamId: String(question.sourceExamId || question.examId || ""),
    certificateId: String(exam.certificateId || question.certificateId || ""),
    certificateName: String(exam.certificateName || question.certificateName || ""),
    learningType,
    studyScope,
    mode: String(payload.mode || "연습모드"),
    selectedAnswerIndex: safeNumber(payload.selectedAnswerIndex, -1),
    correctAnswerIndex: safeNumber(question.answerIndex, -1),
    isCorrect: Boolean(payload.isCorrect),
    confidence: ["high", "medium", "low"].includes(payload.confidence)
      ? payload.confidence
      : (payload.isCorrect ? "medium" : "low"),
    answeredAt,
    updatedAt: Date.now(),
    question: {
      ...question,
      id: questionId,
      examId: question.examId || exam.id || "",
      certificateId: question.certificateId || exam.certificateId || "",
      certificateName: question.certificateName || exam.certificateName || "",
    },
    exam: {
      id: exam.id || question.examId || "",
      certificateId: exam.certificateId || question.certificateId || "",
      certificateName: exam.certificateName || question.certificateName || "",
      assessmentType: exam.assessmentType || "",
      studyScope,
      learningType,
      title: exam.title || "",
    },
  };
}

export function mergeAttemptEvents(events = [], payload = {}) {
  const nextEvent = createAttemptEvent(payload);
  const index = events.findIndex((item) => item.attemptId === nextEvent.attemptId);
  if (index < 0) return [nextEvent, ...events].slice(0, 3000);
  const copy = [...events];
  copy[index] = { ...copy[index], ...nextEvent, updatedAt: Date.now() };
  return copy;
}

export function dedupeAttemptEvents(events = []) {
  const map = new Map();
  [...events]
    .sort((a, b) => safeNumber(a.answeredAt) - safeNumber(b.answeredAt))
    .forEach((item) => {
      if (!item?.attemptId) return;
      map.set(item.attemptId, createAttemptEvent(item));
    });
  return [...map.values()].sort((a, b) => safeNumber(b.answeredAt) - safeNumber(a.answeredAt));
}

export function rebuildLearningProgressFromAttempts(events = []) {
  const ordered = dedupeAttemptEvents(events)
    .sort((a, b) => safeNumber(a.answeredAt) - safeNumber(b.answeredAt));

  return ordered.reduce((records, event) => mergeLearningProgress(records, {
    question: event.question,
    exam: event.exam,
    mode: event.mode,
    studyScope: event.studyScope,
    learningType: event.learningType,
    attemptId: event.attemptId,
    selectedAnswerIndex: event.selectedAnswerIndex,
    isCorrect: event.isCorrect,
    confidence: event.confidence,
    now: event.answeredAt,
  }), []);
}

export function rebuildWrongNotesFromAttempts(events = []) {
  const wrongItems = dedupeAttemptEvents(events)
    .filter((event) => !event.isCorrect)
    .map((event) => ({
      ...event.question,
      selectedAnswerIndex: event.selectedAnswerIndex,
      examTitle: event.exam?.title || "학습",
      examId: event.examId,
      sourceExamId: event.sourceExamId,
      certificateId: event.certificateId,
      certificateName: event.certificateName,
      studyScope: event.studyScope,
      learningType: event.learningType,
      attemptId: event.attemptId,
      createdAt: event.answeredAt,
    }));
  return mergeWrongAttempts([], wrongItems);
}

export function reclassifyAttemptTopics(events = []) {
  return dedupeAttemptEvents(events).map((event) => {
    const question = normalizeQuestionTopic(event.question || {});
    return {
      ...event,
      question,
      questionId: questionProgressId(question),
      updatedAt: Date.now(),
    };
  });
}

export function buildMaintenanceResult(events = []) {
  const normalizedEvents = reclassifyAttemptTopics(events);
  const learningProgress = rebuildLearningProgressFromAttempts(normalizedEvents);
  const wrongNotes = rebuildWrongNotesFromAttempts(normalizedEvents);
  const learningTypes = normalizedEvents.reduce((map, event) => {
    map[event.learningType] = (map[event.learningType] || 0) + 1;
    return map;
  }, {});
  return {
    attemptEvents: normalizedEvents,
    learningProgress,
    wrongNotes,
    summary: {
      attemptCount: normalizedEvents.length,
      questionCount: new Set(normalizedEvents.map((item) => item.questionId)).size,
      wrongQuestionCount: wrongNotes.length,
      learningTypes,
    },
  };
}

export function filterCertificateAttempts(events = [], certificateId = "") {
  if (!certificateId) return events;
  return events.filter((event) => event.certificateId === certificateId);
}
