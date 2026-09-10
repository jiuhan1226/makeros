async function getJson(path, parameters = {}) {
  const query = new URLSearchParams(Object.entries(parameters).filter(([, value]) => value !== "" && value != null));
  let response;
  try {
    response = await fetch(`${path}?${query}`, { headers: { accept: "application/json" } });
  } catch (error) {
    throw Object.assign(new Error("MakerOS API 서버에 연결할 수 없습니다."), { code: "makeros_api_unreachable", cause: error });
  }
  const contentType = response.headers.get("content-type") || "";
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !contentType.includes("application/json")) {
    throw Object.assign(new Error(payload.error || `학교 정보를 불러오지 못했습니다. (HTTP ${response.status})`), { code: payload.code || "school_api_error", status: response.status });
  }
  return payload;
}

export async function loadNeisStatus() {
  return getJson("/api/neis/status");
}

export async function searchSchools(query) {
  return getJson("/api/neis/schools", { q: query });
}

export async function loadSchoolTimetable({ officeCode, schoolCode, schoolKind, grade, classNo, from, to }) {
  return getJson("/api/neis/timetable", { officeCode, schoolCode, schoolKind, grade, classNo, from, to });
}

export async function loadSchoolMeals({ officeCode, schoolCode, from, to }) {
  return getJson("/api/neis/meals", { officeCode, schoolCode, from, to });
}
