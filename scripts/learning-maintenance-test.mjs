import {
  buildMaintenanceResult,
  mergeAttemptEvents,
} from "../src/utils/learningMaintenance.js";
import { masteryStageForProgress, resolveLearningType } from "../src/utils/learningEngine.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const question = {
  id: "q-1",
  examId: "exam-2025-1",
  sourceExamId: "exam-2025-1",
  certificateId: "cert-1",
  subject: "전기이론",
  topic: "직류 회로",
  question: "옴의 법칙은?",
  choices: ["V=IR", "P=VI"],
  answerIndex: 0,
};
const exam = { id: "subject-session", certificateId: "cert-1", studyScope: "subject" };
let events = [];
events = mergeAttemptEvents(events, {
  question,
  exam,
  mode: "연습모드",
  studyScope: "subject",
  attemptId: "s1:q-1",
  selectedAnswerIndex: 0,
  isCorrect: true,
  confidence: "medium",
  answeredAt: Date.parse("2026-07-20T10:00:00Z"),
});
events = mergeAttemptEvents(events, {
  question,
  exam,
  mode: "연습모드",
  studyScope: "subject",
  attemptId: "s1:q-1",
  selectedAnswerIndex: 0,
  isCorrect: true,
  confidence: "high",
  answeredAt: Date.parse("2026-07-20T10:00:00Z"),
});
assert(events.length === 1, "자기평가 수정이 원본 풀이 이벤트를 중복 생성했습니다.");

events = mergeAttemptEvents(events, {
  question,
  exam: { ...exam, studyScope: "due-review", learningType: "srsReview" },
  mode: "연습모드",
  studyScope: "due-review",
  learningType: "srsReview",
  attemptId: "s2:q-1",
  selectedAnswerIndex: 0,
  isCorrect: true,
  confidence: "high",
  answeredAt: Date.parse("2026-07-22T10:00:00Z"),
});

const rebuilt = buildMaintenanceResult(events);
assert(rebuilt.summary.attemptCount === 2, "원본 풀이 이벤트 재계산 개수가 올바르지 않습니다.");
assert(rebuilt.learningProgress[0].attemptCount === 2, "재계산된 문제 풀이 횟수가 올바르지 않습니다.");
assert(rebuilt.learningProgress[0].distinctCorrectDays === 2, "서로 다른 정답 학습일 계산이 올바르지 않습니다.");
assert(masteryStageForProgress(rebuilt.learningProgress[0]).id === "mastered", "마스터 단계 판정이 올바르지 않습니다.");
assert(resolveLearningType(exam, "연습모드", "subject") === "subjectPractice", "학습 경로 분류가 올바르지 않습니다.");

console.log("MakerOS v0.12 learning maintenance tests passed.");
