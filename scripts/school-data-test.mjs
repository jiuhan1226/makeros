import assert from "node:assert/strict";
import { loadSchoolMeals, loadSchoolTimetable, searchSchools } from "../src/utils/schoolApi.js";
import { buildStudyAssetGroups, studyAssetGroup } from "../src/utils/studyAssetGroups.js";

const originalFetch = globalThis.fetch;

function response(payload, contentType = "application/json") {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => name.toLowerCase() === "content-type" ? contentType : "" },
    json: async () => payload,
  };
}

globalThis.fetch = async (url) => {
  const href = String(url);
  if (href.startsWith("/api/")) return response({}, "text/html");
  if (href.includes("/schoolInfo?")) return response({ schoolInfo: [{ row: [{ ATPT_OFCDC_SC_CODE: "N10", ATPT_OFCDC_SC_NM: "충청남도교육청", SD_SCHUL_CODE: "8140347", SCHUL_NM: "공주마이스터고등학교", SCHUL_KND_SC_NM: "고등학교", LCTN_SC_NM: "충청남도", ORG_RDNMA: "공주시 주소" }] }] });
  if (href.includes("/hisTimetable?")) return response({ hisTimetable: [{ row: [{ ALL_TI_YMD: "20260910", GRADE: "1", CLASS_NM: "1", PERIO: "2", ITRT_CNTNT: "전기기기", DDDEP_NM: "전기전자과" }] }] });
  if (href.includes("/mealServiceDietInfo?")) return response({ mealServiceDietInfo: [{ row: [{ MLSV_YMD: "20260910", MMEAL_SC_NM: "중식", DDISH_NM: "쌀밥<br/>김치(9)", CAL_INFO: "700 Kcal", NTR_INFO: "탄수화물 : 100g", ORPLC_INFO: "쌀 : 국내산" }] }] });
  throw new Error(`unexpected URL: ${href}`);
};

try {
  const schools = await searchSchools("공주마이스터");
  assert.equal(schools.schools[0].schoolCode, "8140347");
  const timetable = await loadSchoolTimetable({ officeCode: "N10", schoolCode: "8140347", schoolKind: "고등학교", grade: "1", classNo: "1", from: "2026-09-07", to: "2026-09-11" });
  assert.equal(timetable.lessons[0].subject, "전기기기");
  assert.equal(timetable.teacherDataAvailable, false, "공식 시간표 응답에는 교사명이 없음을 명시해야 합니다.");
  const meals = await loadSchoolMeals({ officeCode: "N10", schoolCode: "8140347", from: "2026-09-07", to: "2026-09-13" });
  assert.deepEqual(meals.meals[0].dishes, ["쌀밥", "김치(9)"]);

  const cards = [
    { sourceType: "PDF", sourceName: "교과서.pdf", pdfId: "pdf-a" },
    { sourceType: "PDF", sourceName: "교과서.pdf", pdfId: "pdf-b" },
    { sourceType: "PDF", sourceName: "교과서.pdf", pdfId: "pdf-a" },
  ];
  assert.equal(buildStudyAssetGroups(cards).length, 2, "파일명이 같아도 서로 다른 PDF 카드는 섞이면 안 됩니다.");
  assert.notEqual(studyAssetGroup(cards[0]).key, studyAssetGroup(cards[1]).key);
  console.log("[school-data-test] OK");
} finally {
  globalThis.fetch = originalFetch;
}
