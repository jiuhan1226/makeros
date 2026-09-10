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
  if (!response.ok || !contentType.includes("application/json")) throw new Error(payload.error || `학교 정보를 불러오지 못했습니다. (HTTP ${response.status})`);
  return payload;
}

function neisRows(payload, dataset) {
  const blocks = Array.isArray(payload?.[dataset]) ? payload[dataset] : [];
  return blocks.find((block) => Array.isArray(block?.row))?.row || [];
}

function neisText(value = "") {
  return String(value).replace(/<br\s*\/?\s*>/gi, "\n").replace(/&amp;/g, "&").replace(/\s+$/gm, "").trim();
}

async function directNeis(dataset, parameters = {}) {
  const query = new URLSearchParams({ Type: "json", pIndex: "1", pSize: "100", ...parameters });
  let response;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(`https://open.neis.go.kr/hub/${dataset}?${query}`, { headers: { accept: "application/json" } });
      if (response.ok || ![429, 500, 502, 503, 504].includes(response.status)) break;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
  }
  if (!response) throw Object.assign(new Error("나이스 교육정보에 직접 연결할 수 없습니다."), { code: "neis_network_unreachable", cause: lastError });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`나이스 교육정보 API 연결 실패 (HTTP ${response.status})`);
  const result = payload?.RESULT || payload?.[dataset]?.[0]?.head?.find((item) => item.RESULT)?.RESULT;
  if (result?.CODE && !["INFO-000", "INFO-200"].includes(result.CODE)) throw new Error(result.MESSAGE || "나이스 교육정보를 불러오지 못했습니다.");
  return neisRows(payload, dataset);
}

async function withNeisFallback(serverRequest, directRequest) {
  let serverError;
  try {
    return await serverRequest();
  } catch (error) {
    serverError = error;
  }
  try {
    return await directRequest();
  } catch (directError) {
    const serverMissing = serverError?.code === "makeros_api_unreachable";
    const message = serverMissing
      ? "학교 정보 서버에 연결할 수 없습니다. 로컬에서는 ‘npm run dev’로 화면과 API 서버를 함께 실행해 주세요. API 키 누락 오류는 아닙니다."
      : "나이스 교육정보가 일시적으로 응답하지 않습니다. 잠시 후 새로고침해 주세요. API 키 누락 오류는 아닙니다.";
    throw Object.assign(new Error(message), { code: serverMissing ? "school_server_unreachable" : "neis_unavailable", cause: directError });
  }
}

function timetableDataset(kind = "") {
  if (kind.includes("초등")) return "elsTimetable";
  if (kind.includes("중학교")) return "misTimetable";
  if (kind.includes("특수")) return "spsTimetable";
  return "hisTimetable";
}

export async function searchSchools(query) {
  return withNeisFallback(
    () => getJson("/api/schools", { q: query }),
    async () => {
    const rows = await directNeis("schoolInfo", { pSize: "30", SCHUL_NM: query });
    return { schools: rows.map((row) => ({ officeCode: row.ATPT_OFCDC_SC_CODE, officeName: row.ATPT_OFCDC_SC_NM, schoolCode: row.SD_SCHUL_CODE, schoolName: row.SCHUL_NM, schoolKind: row.SCHUL_KND_SC_NM, region: row.LCTN_SC_NM, address: row.ORG_RDNMA })), source: "NEIS 교육정보 개방 API" };
    },
  );
}

export async function loadSchoolTimetable({ officeCode, schoolCode, schoolKind, grade, classNo, from, to }) {
  return withNeisFallback(
    () => getJson("/api/school/timetable", { officeCode, schoolCode, schoolKind, grade, classNo, from, to }),
    async () => {
    const rows = await directNeis(timetableDataset(schoolKind), { pSize: "1000", ATPT_OFCDC_SC_CODE: officeCode, SD_SCHUL_CODE: schoolCode, GRADE: grade, CLASS_NM: classNo, TI_FROM_YMD: from.replace(/-/g, ""), TI_TO_YMD: to.replace(/-/g, "") });
    return { lessons: rows.map((row) => ({ date: row.ALL_TI_YMD, grade: row.GRADE, classNo: row.CLASS_NM || row.CLRM_NM, period: Number(row.PERIO), subject: neisText(row.ITRT_CNTNT), department: row.DDDEP_NM || "", room: row.CLRM_NM || "", teacher: "" })), teacherDataAvailable: false, source: "NEIS 교육정보 개방 API", loadedAt: Date.now() };
    },
  );
}

export async function loadSchoolMeals({ officeCode, schoolCode, from, to }) {
  return withNeisFallback(
    () => getJson("/api/school/meals", { officeCode, schoolCode, from, to }),
    async () => {
    const rows = await directNeis("mealServiceDietInfo", { pSize: "100", ATPT_OFCDC_SC_CODE: officeCode, SD_SCHUL_CODE: schoolCode, MLSV_FROM_YMD: from.replace(/-/g, ""), MLSV_TO_YMD: to.replace(/-/g, "") });
    return { meals: rows.map((row) => ({ date: row.MLSV_YMD, type: row.MMEAL_SC_NM, dishes: neisText(row.DDISH_NM).split("\n").filter(Boolean), calories: row.CAL_INFO || "", nutrition: neisText(row.NTR_INFO).split("\n").filter(Boolean), origin: neisText(row.ORPLC_INFO) })), source: "NEIS 교육정보 개방 API", loadedAt: Date.now() };
    },
  );
}
