import { postJsonWithToken } from "./api";
import {
  auth,
  getUserAiExplanation,
  saveUserAiExplanation,
  submitAiExplanationFeedback as saveAiExplanationFeedback,
  submitAiExplanationReview,
} from "../firebase";

const CACHE_PREFIX = "makeros:cbt-ai-explanation:v2:";
const inflight = new Map();

function hashText(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function explanationFingerprint(question = {}) {
  return hashText(JSON.stringify({
    id: question.id || "",
    question: question.question || "",
    choices: Array.isArray(question.choices) ? question.choices : [],
    answerIndex: Number(question.answerIndex),
    questionImageUrls: question.questionImageUrls || [],
    imageUrl: question.imageUrl || "",
    choiceImageUrls: question.choiceImageUrls || [],
  }));
}

function cacheKey(question) {
  return `${CACHE_PREFIX}${explanationFingerprint(question)}`;
}

export function hasQuestionImages(question = {}) {
  return Boolean(
    question.imageUrl
    || (Array.isArray(question.questionImageUrls) && question.questionImageUrls.some(Boolean))
    || (Array.isArray(question.choiceImageUrls) && question.choiceImageUrls.some(Boolean))
  );
}

function isCacheShapeValid(parsed, question) {
  return Boolean(
    parsed?.verified
    && parsed?.signature
    && parsed?.questionHash
    && Number(parsed.officialAnswerIndex) === Number(question.answerIndex)
  );
}

export function readCachedExplanation(question) {
  try {
    const raw = localStorage.getItem(cacheKey(question));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isCacheShapeValid(parsed, question) ? { ...parsed, cached: true, cacheSource: "device" } : null;
  } catch {
    return null;
  }
}

export function clearCachedExplanation(question) {
  try { localStorage.removeItem(cacheKey(question)); }
  catch { /* 저장소를 사용할 수 없는 환경은 무시합니다. */ }
}

function writeCachedExplanation(question, result) {
  if (!isCacheShapeValid(result, question)) return;
  try {
    localStorage.setItem(cacheKey(question), JSON.stringify({
      ...result,
      cachedAt: Date.now(),
    }));
  } catch {
    // 저장 용량 부족 시에도 현재 해설 표시는 계속 허용합니다.
  }
}

async function authContext() {
  const user = auth?.currentUser;
  if (!user) throw new Error("검증된 AI 해설을 사용하려면 로그인해 주세요.");
  const token = await user.getIdToken();
  return { user, uid: user.uid, token };
}

async function verifyStoredExplanation(record, question, token) {
  if (!isCacheShapeValid(record, question)) return null;
  try {
    const verified = await postJsonWithToken(
      "/api/cbt/verify-explanation-cache",
      {
        record,
        question: question.question || "",
        choices: Array.isArray(question.choices) ? question.choices : [],
        answerIndex: Number(question.answerIndex),
        subject: question.subject || "공통",
        topic: question.topic || "",
      },
      token,
      "저장된 AI 해설을 검증하지 못했습니다.",
    );
    return verified?.verified ? { ...verified, cached: true, cacheSource: record.cacheSource || "cloud" } : null;
  } catch {
    return null;
  }
}

async function loadTrustedCache(question, context) {
  const local = readCachedExplanation(question);
  if (local) {
    const trusted = await verifyStoredExplanation(local, question, context.token);
    if (trusted) return trusted;
    clearCachedExplanation(question);
  }

  const cloud = await getUserAiExplanation(context.uid, explanationFingerprint(question)).catch(() => null);
  if (cloud) {
    const trusted = await verifyStoredExplanation({ ...cloud, cacheSource: "cloud" }, question, context.token);
    if (trusted) {
      writeCachedExplanation(question, trusted);
      return trusted;
    }
  }
  return null;
}

export async function requestVerifiedCbtExplanation(question, { force = false } = {}) {
  const context = await authContext();

  if (!force) {
    const cached = await loadTrustedCache(question, context);
    if (cached) return cached;
  } else {
    clearCachedExplanation(question);
  }

  const fingerprint = explanationFingerprint(question);
  if (!force && inflight.has(fingerprint)) return inflight.get(fingerprint);

  const request = postJsonWithToken(
    "/api/cbt/generate-explanation",
    {
      questionId: question.id || "",
      clientFingerprint: fingerprint,
      question: question.question || "",
      choices: Array.isArray(question.choices) ? question.choices : [],
      answerIndex: Number(question.answerIndex),
      subject: question.subject || "공통",
      topic: question.topic || "",
      hasImages: hasQuestionImages(question),
      force,
    },
    context.token,
    "AI 해설을 생성하지 못했습니다.",
  ).then(async (result) => {
    if (result?.verified) {
      const trusted = { ...result, clientFingerprint: fingerprint };
      writeCachedExplanation(question, trusted);
      await saveUserAiExplanation(context.uid, trusted).catch(() => {});
      return trusted;
    }
    if (result?.status === "needs_review") {
      await submitAiExplanationReview({
        uid: context.uid,
        question,
        result: { ...result, clientFingerprint: fingerprint },
        reason: "verification_failed",
      }).catch(() => {});
    }
    return { ...result, clientFingerprint: fingerprint };
  }).finally(() => {
    inflight.delete(fingerprint);
  });

  inflight.set(fingerprint, request);
  return request;
}

export async function submitExplanationFeedback({ question, result, reason, comment = "" }) {
  const context = await authContext();
  return saveAiExplanationFeedback({
    uid: context.uid,
    question,
    result,
    reason,
    comment,
  });
}
