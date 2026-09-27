import assert from "node:assert/strict";
import {
  applyTeacherReview,
  auditTeacherQuestionSet,
  buildTeacherQuestionBlueprint,
  deduplicateTeacherQuestions,
  questionSimilarity,
  teacherBlueprintPrompt,
  validateTeacherQuestion,
} from "../server/teacherQuestionDesign.mjs";

const mixed = buildTeacherQuestionBlueprint({ count: 20, difficultyMode: "교사 추천 혼합" });
assert.deepEqual(mixed.difficulty, { 쉬움: 6, 보통: 10, 어려움: 4 });
assert.equal(Object.values(mixed.questionTypes).reduce((sum, count) => sum + count, 0), 20);
assert.deepEqual(mixed.questionTypes, {
  "핵심 개념 확인": 6,
  "원리 이해": 4,
  "비교·구분": 3,
  "계산·적용": 3,
  "상황·자료 해석": 4,
});

const fixed = buildTeacherQuestionBlueprint({ count: 5, difficultyMode: "어려움" });
assert.deepEqual(fixed.difficulty, { 쉬움: 0, 보통: 0, 어려움: 5 });
assert.match(teacherBlueprintPrompt(mixed, "옴의 법칙, 직렬 회로"), /사용자가 입력한 학습목표·강조 내용/);

const valid = {
  question: "직렬 회로의 전류에 대한 설명으로 옳은 것은 무엇인가?",
  subject: "전기 회로",
  choices: ["모든 지점에서 같다.", "저항마다 항상 다르다.", "전압과 무관하게 0이다.", "병렬 회로에서만 흐른다.", "전원과 반대 방향으로만 흐른다."],
  answerIndex: 0,
  explanation: "직렬 회로에서는 회로의 모든 지점에 같은 전류가 흐른다.",
  evidencePage: 2,
  evidence: "직렬 회로의 각 지점에는 같은 전류가 흐른다.",
  difficulty: "보통",
  questionType: "핵심 개념 확인",
  learningObjective: "직렬 회로의 전류 특성",
  selectionReason: "다른 회로 개념의 바탕이 되는 핵심 원리를 확인하기 위해 선정했다.",
  choiceExplanations: ["본문과 일치한다.", "직렬 회로에서는 지점별로 달라지지 않는다.", "전류가 항상 0이라는 근거가 없다.", "직렬 회로에도 전류가 흐른다.", "전류 방향에 관한 잘못된 설명이다."],
};
assert.equal(validateTeacherQuestion(valid).ok, true);
assert.equal(validateTeacherQuestion({ ...valid, choices: [...valid.choices.slice(0, 4), valid.choices[0]] }).ok, false);
assert.equal(validateTeacherQuestion({ ...valid, choiceExplanations: [] }).ok, false);

const nearDuplicate = { ...valid, question: "직렬회로의 전류에 관한 설명 중 옳은 것은 무엇인가?" };
assert.ok(questionSimilarity(valid.question, nearDuplicate.question) > 0.45);
assert.equal(deduplicateTeacherQuestions([valid, nearDuplicate], 0.4).length, 1);

const reviewed = applyTeacherReview([valid, { ...valid, question: "병렬 회로의 전압 특성은 무엇인가?" }], [
  { index: 0, accepted: true, sourceSupported: true, singleCorrectAnswer: true, distractorsPlausible: true, answerIndex: 0, issues: [], model: "review-model" },
  { index: 1, accepted: false, sourceSupported: true, singleCorrectAnswer: false, distractorsPlausible: true, answerIndex: 0, issues: ["복수 정답 가능"] },
]);
assert.equal(reviewed.length, 1);
assert.equal(reviewed[0].teacherReviewStatus, "verified");
assert.equal(reviewed[0].teacherReviewModel, "review-model");
assert.equal(reviewed[0].reviewMethod, "teacher-survey-ai-review");

const audited = auditTeacherQuestionSet([
  { ...valid, difficulty: "쉬움", questionType: "핵심 개념 확인", answerIndex: 0 },
  { ...valid, question: "병렬 회로의 전압 관계를 고르시오.", difficulty: "보통", questionType: "원리 이해", answerIndex: 1 },
  { ...valid, question: "직렬 회로와 병렬 회로를 비교한 것은?", difficulty: "보통", questionType: "비교·구분", answerIndex: 2 },
  { ...valid, question: "옴의 법칙을 회로에 적용한 값은?", difficulty: "어려움", questionType: "계산·적용", answerIndex: 3 },
  { ...valid, question: "제시된 회로 상황을 해석한 것은?", difficulty: "보통", questionType: "상황·자료 해석", answerIndex: 4 },
], buildTeacherQuestionBlueprint({ count: 5 }));
assert.equal(audited.humanReviewed, false, "AI 자동검수를 사람 검수로 표시하면 안 됩니다.");
assert.equal(audited.verifiedCount, 5);
assert.equal(audited.answerPositions.reduce((sum, count) => sum + count, 0), 5);

console.log("teacher-question-design-test: ok");
