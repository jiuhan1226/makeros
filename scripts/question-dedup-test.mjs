import assert from "node:assert/strict";
import { deduplicateQuestions, normalizeQuestionText, questionContentKey, removeQuestionFromList } from "../src/utils/questionDedup.js";

const base = {
  id: "exam-a-1",
  question: "다음 중 옳은 것은?",
  choices: ["전압은 V이다.", "전류는 A이다.", "저항은 Ω이다.", "전력은 W이다."],
  answerIndex: 2,
  explanation: "첫 번째 해설",
  examTitle: "2024년 1회",
};

const reordered = {
  ...base,
  id: "exam-b-17",
  question: "다음 중 옳은 것은?\u00a0",
  choices: ["전력은 W이다.", "저항은 Ω이다.", "전압은 V이다.", "전류는 A이다."],
  answerIndex: 1,
  explanation: "",
  examTitle: "2025년 2회",
};

const differentAnswer = { ...base, id: "exam-c-2", answerIndex: 0 };
const differentMath = { ...base, id: "exam-d-2", question: "2 + 2의 값은?", choices: ["3", "4"], answerIndex: 1 };
const differentMathCompact = { ...differentMath, id: "exam-e-2", question: "22의 값은?" };

assert.equal(normalizeQuestionText("  전 압\u00a0"), "전압");
assert.equal(questionContentKey(base), questionContentKey(reordered), "보기 순서가 달라도 정답 내용이 같으면 중복이어야 합니다.");
assert.notEqual(questionContentKey(base), questionContentKey(differentAnswer), "정답이 다르면 별도 문제여야 합니다.");
assert.notEqual(questionContentKey(differentMath), questionContentKey(differentMathCompact), "수학 기호를 제거해 다른 문제를 합치면 안 됩니다.");

const result = deduplicateQuestions([base, reordered, differentAnswer]);
assert.equal(result.totalCount, 3);
assert.equal(result.duplicateCount, 1);
assert.equal(result.questions.length, 2);
assert.deepEqual(result.questions[0].duplicateSources, ["2024년 1회", "2025년 2회"]);

const afterRemove = removeQuestionFromList(result.questions, reordered);
assert.equal(afterRemove.length, 1, "같은 내용의 북마크를 한 번에 제거해야 합니다.");

console.log("question dedup tests passed");
