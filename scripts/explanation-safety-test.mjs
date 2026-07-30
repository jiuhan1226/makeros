import {
  buildExplanationHash,
  findConflictingAnswerClaims,
  normalizeDraftExplanation,
  normalizeVerificationResult,
  validateVerifiedExplanation,
  signExplanationRecord,
  verifyExplanationRecordSignature,
} from "../server/cbtExplanation.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const base = {
  question: "다음 중 옳은 것은?",
  choices: ["정답 선택지", "오답 선택지", "다른 오답", "또 다른 오답"],
  answerIndex: 0,
  subject: "전기이론",
};
assert(
  buildExplanationHash(base) !== buildExplanationHash({ ...base, answerIndex: 1 }),
  "정답이 바뀌면 해설 캐시 해시도 바뀌어야 합니다.",
);

const draft = normalizeDraftExplanation({
  statedAnswerIndex: 0,
  explanation: "공식 정답은 ①이며, 문제의 조건과 첫 번째 선택지의 설명이 일치합니다.",
  keyPoint: "문제 조건과 선택지의 일치 여부를 확인합니다.",
  choiceReasons: [
    { index: 0, reason: "문제 조건과 일치합니다." },
    { index: 1, reason: "문제 조건과 다릅니다." },
    { index: 2, reason: "핵심 조건을 충족하지 않습니다." },
    { index: 3, reason: "적용 범위가 다릅니다." },
  ],
  cannotExplain: false,
}, 4);
const verification = normalizeVerificationResult({
  verified: true,
  confirmedAnswerIndex: 0,
  answerSheetConcern: false,
  confidence: "high",
});
const safe = validateVerifiedExplanation({
  draft,
  verification,
  officialAnswerIndex: 0,
  finalExplanation: `${draft.explanation} ${draft.keyPoint}`,
});
assert(safe.valid, `정상 해설이 차단되었습니다: ${safe.issues.join(", ")}`);

assert(
  findConflictingAnswerClaims("정답은 ②입니다.", 0).includes(1),
  "공식 정답과 충돌하는 명시적 답안 표현을 찾아야 합니다.",
);

const unsafe = validateVerifiedExplanation({
  draft: { ...draft, statedAnswerIndex: 1 },
  verification,
  officialAnswerIndex: 0,
  finalExplanation: "정답은 ②입니다. 공식 정답과 다른 결론을 설명하는 충분히 긴 잘못된 해설입니다.",
});
assert(!unsafe.valid, "정답 번호가 충돌하는 해설은 검증을 통과하면 안 됩니다.");

const signedRecord = {
  status: "verified",
  verified: true,
  officialAnswerIndex: 0,
  explanation: draft.explanation,
  keyPoint: draft.keyPoint,
  choiceReasons: draft.choiceReasons,
  questionHash: buildExplanationHash(base),
  version: 2,
  model: "test / verifier",
};
signedRecord.signature = signExplanationRecord(signedRecord, "test-secret");
assert(verifyExplanationRecordSignature(signedRecord, "test-secret"), "서버 서명 검증이 실패했습니다.");
assert(
  !verifyExplanationRecordSignature({ ...signedRecord, explanation: "변조된 해설" }, "test-secret"),
  "변조된 AI 해설이 서버 서명 검증을 통과했습니다.",
);

console.log("MakerOS v0.12 signed and verified CBT explanation safety tests passed.");
