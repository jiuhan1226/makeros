import { auth } from "../firebase";

export async function readJsonResponse(response, fallbackMessage = "요청을 처리하지 못했습니다.") {
  const text = await response.text();
  let body = {};

  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      const clean = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      throw new Error(
        response.ok
          ? "AI 서버가 올바른 형식의 응답을 보내지 않았습니다. 잠시 후 다시 시도해 주세요."
          : clean.slice(0, 180) || `${fallbackMessage} (HTTP ${response.status})`,
      );
    }
  } else if (!response.ok) {
    throw new Error(`${fallbackMessage} (HTTP ${response.status}, 빈 응답)`);
  } else {
    throw new Error("AI 서버 응답이 비어 있습니다. API 서버가 실행 중인지 확인한 뒤 다시 시도해 주세요.");
  }

  if (!response.ok) {
    const error = new Error(body?.error || `${fallbackMessage} (HTTP ${response.status})`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function requestJson(url, payload, fallbackMessage, headers = {}) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("AI 서버에 연결하지 못했습니다. npm run dev로 웹과 API 서버가 함께 실행 중인지 확인해 주세요.");
  }
  return readJsonResponse(response, fallbackMessage);
}

export async function postJson(url, payload, fallbackMessage) {
  const user = auth?.currentUser;
  const token = user ? await user.getIdToken() : "";
  return requestJson(
    url,
    payload,
    fallbackMessage,
    token ? { Authorization: `Bearer ${token}` } : {},
  );
}

export function postJsonWithToken(url, payload, token, fallbackMessage) {
  return requestJson(
    url,
    payload,
    fallbackMessage,
    token ? { Authorization: `Bearer ${token}` } : {},
  );
}
