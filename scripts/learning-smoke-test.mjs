import { gradeExam } from "../src/utils/exam.js";
import {
  buildExamReadiness,
  isTargetedPracticeRecord,
  mergeLearningProgress,
  migrateLearningState,
} from "../src/utils/learningEngine.js";
import { classifyQuestionTopic, consolidateQuestionTopics } from "../src/utils/topicClassifier.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const questions = Array.from({ length: 100 }, (_, index) => ({
  id: `q${index}`,
  answerIndex: index % 4,
  subject: index < 20 ? "과목 A" : "과목 B",
}));
const answers = {};
for (let index = 0; index < 8; index += 1) answers[index] = index % 4;
answers[7] = 0;

const practice = gradeExam(questions, answers, { assessmentType: "practice" }, "연습모드");
assert(practice.total === 8, "연습모드는 답한 8문제만 계산해야 합니다.");
assert(practice.correct === 7 && practice.wrong === 1, "연습모드 정오답 계산이 올바르지 않습니다.");
assert(practice.unanswered === 92, "미응답 문제 수가 올바르지 않습니다.");

const exam = gradeExam(questions, answers, { assessmentType: "exam" }, "실전모드");
assert(exam.total === 100 && exam.wrong === 93, "실전모드는 전체 문제를 채점해야 합니다.");

const migrated = migrateLearningState({
  history: [
    { sessionId: "practice", mode: "연습모드", total: 100, correct: 8 },
    { sessionId: "exam", mode: "실전모드", total: 100, correct: 60 },
  ],
  wrongNotes: [
    { id: "unanswered" },
    { id: "answered", selectedAnswerIndex: 2 },
  ],
  learningProgress: [
    {
      questionId: "old-topic",
      subject: "승강기개론",
      topic: "미분류 주제",
      tags: ["미분류 주제"],
      question: "권상기의 트랙션 시브에 대한 설명으로 옳은 것은?",
      choices: ["보기 1", "보기 2"],
    },
  ],
});
assert(migrated.history.length === 1, "시험형 기록 분리가 실패했습니다.");
assert(migrated.practiceHistory.length === 1, "연습 기록 분리가 실패했습니다.");
assert(migrated.wrongNotes.length === 1, "과거 미응답 오답 기록 정리가 실패했습니다.");
assert(migrated.learningProgress[0].topic === "권상기·구동장치", "기존 미분류 주제 자동 복구가 실패했습니다.");

const classified = classifyQuestionTopic({
  subject: "기계,전기기초이론",
  question: "옴의 법칙에서 전압과 전류 및 저항의 관계로 옳은 것은?",
  choices: ["V=IR", "P=VI"],
});
assert(classified.topic === "직류·교류 회로", "문제 핵심어 기반 주제 분류가 실패했습니다.");

const consolidatedTopics = consolidateQuestionTopics([
  {
    id: "topic-1",
    subject: "기계,전기기초이론",
    topic: "전압 계산",
    question: "옴의 법칙에서 전압과 전류 및 저항의 관계는?",
    choices: ["V=IR"],
  },
  {
    id: "topic-2",
    subject: "기계,전기기초이론",
    topic: "저항 공식",
    question: "직렬 회로의 저항과 전류 관계로 옳은 것은?",
    choices: ["V=IR"],
  },
  {
    id: "topic-3",
    subject: "기계,전기기초이론",
    topic: "전동기 원리",
    question: "유도전동기의 슬립에 대한 설명은?",
    choices: ["유도전동기"],
  },
  {
    id: "topic-4",
    subject: "기계,전기기초이론",
    topic: "변압기 원리",
    question: "변압기의 권수비와 전압비 관계는?",
    choices: ["변압기"],
  },
], { minTopicSize: 2 });
assert(consolidatedTopics.stats.originalTopicCount === 4, "통합 전 주제 수 계산이 올바르지 않습니다.");
assert(consolidatedTopics.stats.finalTopicCount === 2, "2문제 미만 세부 주제 통합이 실패했습니다.");
assert(
  consolidatedTopics.questions.filter((item) => item.topic === "직류·교류 회로").length === 2,
  "유사 전기회로 주제가 함께 묶이지 않았습니다.",
);
assert(
  consolidatedTopics.questions.filter((item) => item.topic === "전동기·변압기").length === 2,
  "유사 전기기기 주제가 함께 묶이지 않았습니다.",
);


let progress = [];
const payload = {
  question: { ...questions[0], sourceExamId: "exam-1", examYear: 2023 },
  exam: { id: "subject-session", studyScope: "subject" },
  mode: "연습모드",
  studyScope: "subject",
  attemptId: "attempt-1",
  selectedAnswerIndex: 0,
  isCorrect: true,
  confidence: "medium",
  now: 1000,
};
progress = mergeLearningProgress(progress, payload);
progress = mergeLearningProgress(progress, { ...payload, confidence: "high", now: 2000 });
assert(progress[0].attemptCount === 1, "자기평가 수정이 풀이 횟수를 중복 증가시켰습니다.");
assert(progress[0].correctCount === 1, "자기평가 수정이 정답 횟수를 중복 증가시켰습니다.");
assert(progress[0].sourceExamId === "exam-1", "원본 기출 회차 추적이 실패했습니다.");
assert(isTargetedPracticeRecord({ studyScope: "subject" }), "과목 학습 범위 판별에 실패했습니다.");
assert(!isTargetedPracticeRecord({ studyScope: "exam-practice" }), "기출 연습이 과목 학습으로 섞였습니다.");

const examCatalog = Array.from({ length: 12 }, (_, examIndex) => ({
  id: `exam-${examIndex + 1}`,
  questionCount: 60,
}));
const readiness = buildExamReadiness({
  progress,
  exams: examCatalog,
  plan: { examDate: "2099-12-31", studyDays: [1, 2, 3, 4, 5, 6] },
});
assert(readiness.recommendedExamSessions === 12, "기출 12회차 목표가 적용되지 않았습니다.");
assert(readiness.targetQuestionCount === 720, "12회차 기준 목표 문제 수 계산이 올바르지 않습니다.");
assert(readiness.readinessScore < 20, "소수 문제만 풀었는데 준비도가 과도하게 높습니다.");
assert(readiness.recommendedDailyQuestions >= 10, "권장 일일 문제 수 하한 계산이 올바르지 않습니다.");

console.log("MakerOS v0.12 learning, topic and readiness smoke tests passed.");
