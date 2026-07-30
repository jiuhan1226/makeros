import crypto from "node:crypto";

const CIRCLED = ["①", "②", "③", "④", "⑤"];

function clean(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function buildExplanationHash(payload = {}) {
  return crypto.createHash("sha256").update(JSON.stringify({
    question: clean(payload.question),
    choices: Array.isArray(payload.choices) ? payload.choices.map(clean) : [],
    answerIndex: Number(payload.answerIndex),
    subject: clean(payload.subject),
    topic: clean(payload.topic),
  })).digest("hex");
}

export function normalizeDraftExplanation(raw = {}, choiceCount = 0) {
  const reasons = Array.isArray(raw.choiceReasons) ? raw.choiceReasons : [];
  const byIndex = new Map();
  reasons.forEach((item, order) => {
    const index = Number(item?.index ?? order);
    if (Number.isInteger(index) && index >= 0 && index < choiceCount) {
      byIndex.set(index, clean(item?.reason || item?.explanation || ""));
    }
  });
  return {
    statedAnswerIndex: Number(raw.statedAnswerIndex),
    explanation: clean(raw.explanation),
    keyPoint: clean(raw.keyPoint),
    choiceReasons: Array.from({ length: choiceCount }, (_, index) => ({
      index,
      reason: byIndex.get(index) || "",
    })),
    cannotExplain: Boolean(raw.cannotExplain),
    uncertainty: (Array.isArray(raw.uncertainty) ? raw.uncertainty : []).map(clean).filter(Boolean).slice(0, 6),
  };
}

export function normalizeVerificationResult(raw = {}) {
  return {
    verified: Boolean(raw.verified),
    confirmedAnswerIndex: Number(raw.confirmedAnswerIndex),
    issues: (Array.isArray(raw.issues) ? raw.issues : []).map(clean).filter(Boolean).slice(0, 8),
    correctedExplanation: clean(raw.correctedExplanation),
    correctedKeyPoint: clean(raw.correctedKeyPoint),
    answerSheetConcern: Boolean(raw.answerSheetConcern),
    confidence: ["high", "medium", "low"].includes(raw.confidence) ? raw.confidence : "low",
  };
}

export function findConflictingAnswerClaims(text, officialAnswerIndex) {
  const claims = new Set();
  const source = clean(text);
  const patterns = [
    /(?:정답|답)\s*(?:은|는|:|=)?\s*([①②③④⑤]|[1-5])(?:번)?/g,
    /(?:correct answer|answer)\s*(?:is|:|=)?\s*([1-5])/gi,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source))) {
      const token = match[1];
      const index = CIRCLED.includes(token) ? CIRCLED.indexOf(token) : Number(token) - 1;
      if (Number.isInteger(index)) claims.add(index);
    }
  }
  return [...claims].filter((index) => index !== Number(officialAnswerIndex));
}

export function validateVerifiedExplanation({ draft, verification, officialAnswerIndex, finalExplanation }) {
  const issues = [];
  if (!Number.isInteger(Number(officialAnswerIndex))) issues.push("공식 정답 번호가 유효하지 않습니다.");
  if (draft.cannotExplain) issues.push("1차 생성 모델이 안전한 해설 생성을 거부했습니다.");
  if (Number(draft.statedAnswerIndex) !== Number(officialAnswerIndex)) issues.push("1차 해설의 정답 번호가 공식 정답과 다릅니다.");
  if (!verification.verified) issues.push("2차 검증을 통과하지 못했습니다.");
  if (verification.answerSheetConcern) issues.push("2차 검증에서 정답표 또는 문항 검토 필요성이 감지되었습니다.");
  if (Number(verification.confirmedAnswerIndex) !== Number(officialAnswerIndex)) issues.push("2차 검증의 확인 정답이 공식 정답과 다릅니다.");
  if (clean(finalExplanation).length < 30) issues.push("검증된 해설이 너무 짧습니다.");
  const conflicts = findConflictingAnswerClaims(finalExplanation, officialAnswerIndex);
  if (conflicts.length) issues.push(`해설 안에 공식 정답과 다른 정답 표현이 있습니다: ${conflicts.map((index) => CIRCLED[index] || index + 1).join(", ")}`);
  return { valid: issues.length === 0, issues };
}

function stableExplanationPayload(record = {}) {
  return JSON.stringify({
    status: String(record.status || ""),
    verified: Boolean(record.verified),
    officialAnswerIndex: Number(record.officialAnswerIndex),
    explanation: clean(record.explanation),
    keyPoint: clean(record.keyPoint),
    choiceReasons: Array.isArray(record.choiceReasons)
      ? record.choiceReasons.map((item) => ({ index: Number(item?.index), reason: clean(item?.reason) }))
      : [],
    questionHash: String(record.questionHash || ""),
    version: Number(record.version || 1),
    model: String(record.model || ""),
  });
}

export function signExplanationRecord(record = {}, secret = "") {
  if (!secret) throw new Error("AI 해설 서명 비밀키가 설정되지 않았습니다.");
  return crypto.createHmac("sha256", secret).update(stableExplanationPayload(record)).digest("hex");
}

export function verifyExplanationRecordSignature(record = {}, secret = "") {
  const provided = String(record?.signature || "");
  if (!provided || !secret) return false;
  const expected = signExplanationRecord(record, secret);
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
