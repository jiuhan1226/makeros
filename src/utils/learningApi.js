import { postJson } from "./api";

export async function requestLearningCoach(payload) {
  return postJson(
    "/api/cbt-learning-coach",
    payload,
    "AI 고득점 가이드를 생성하지 못했습니다.",
  );
}
