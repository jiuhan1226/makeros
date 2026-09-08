import assert from "node:assert/strict";
import {
  buildDiagnosticProfile,
  buildFallbackDiagnostic,
  diagnosticReferencePayload,
  normalizeGeneratedDiagnostic,
  selectDiagnosticReferences,
} from "../src/utils/partnerDiagnostic.js";

const certificate = { id: "safety", name: "산업안전산업기사" };
const questions = Array.from({ length: 18 }, (_, index) => ({
  id: `q-${index + 1}`,
  subject: index < 9 ? "산업안전관리론" : "인간공학",
  topic: index % 2 ? "위험성평가" : "안전관리",
  question: `기출 참고 문제 ${index + 1}의 내용은 무엇인가?`,
  choices: ["선택 1", "선택 2", "선택 3", "선택 4"],
  answerIndex: index % 4,
  explanation: "등록 정답을 기준으로 판단합니다.",
}));
const progress = questions.slice(0, 6).map((question, index) => ({
  questionId: question.id,
  subject: question.subject,
  attemptCount: 1,
  correctCount: index < 2 ? 1 : 0,
  wrongCount: index < 2 ? 0 : 1,
}));

const profile = buildDiagnosticProfile({ questions, progress });
assert.equal(profile.attemptCount, 6);
assert.equal(profile.accuracy, 33);
assert.equal(profile.stage, "진단 데이터 부족");
assert.equal(profile.weakSubjects[0], "산업안전관리론");

const references = selectDiagnosticReferences({
  questions,
  progress,
  weakSubjects: profile.weakSubjects,
  limit: 10,
});
assert.equal(references.length, 10);
assert.ok(references.some((question) => question.subject === "산업안전관리론"));
assert.ok(references.some((question) => question.subject === "인간공학"));

const payload = diagnosticReferencePayload(references);
assert.equal(payload.length, 10);
assert.ok(payload.every((question) => question.id && question.choices.length === 4));

const generated = normalizeGeneratedDiagnostic([{
  sourceId: payload[0].id,
  subject: payload[0].subject,
  topic: payload[0].topic,
  question: "작업 전 위험요인을 확인할 때 가장 적절한 판단은?",
  choices: ["보기 A", "보기 B", "보기 C", "보기 D"],
  answerIndex: 1,
  explanation: "참고 기출의 정답 관계를 적용한 해설입니다.",
}], certificate);
assert.equal(generated.length, 1);
assert.equal(generated[0].aiGenerated, true);
assert.equal(generated[0].certificateId, "safety");

const fallback = buildFallbackDiagnostic(references, certificate, 5);
assert.equal(fallback.length, 5);
assert.ok(fallback.every((question) => question.sourceType === "cbt-reference"));

console.log("[partner-diagnostic-test] OK");
