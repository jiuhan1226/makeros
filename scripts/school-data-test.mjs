import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadNeisStatus, loadSchoolMeals, loadSchoolTimetable, searchSchools } from "../src/utils/schoolApi.js";
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

const requestedUrls = [];
globalThis.fetch = async (url) => {
  const href = String(url);
  requestedUrls.push(href);
  if (href.startsWith("/api/neis/status")) return response({ configured: true, connected: true, route: "server-only" });
  if (href.startsWith("/api/neis/schools")) return response({ schools: [{ officeCode: "N10", officeName: "충청남도교육청", schoolCode: "8140347", schoolName: "공주마이스터고등학교", schoolKind: "고등학교", region: "충청남도", address: "공주시 주소" }], source: "NEIS 공식 Open API · 서버 인증" });
  if (href.startsWith("/api/neis/timetable")) return response({ lessons: [{ date: "20260910", grade: "1", classNo: "1", period: 2, subject: "전기기기", department: "전기전자과", teacher: "" }], teacherDataAvailable: false, source: "NEIS 공식 Open API · 서버 인증" });
  if (href.startsWith("/api/neis/meals")) return response({ meals: [{ date: "20260910", type: "중식", dishes: ["쌀밥", "김치(9)"], calories: "700 Kcal", nutrition: ["탄수화물 : 100g"], origin: "쌀 : 국내산" }], source: "NEIS 공식 Open API · 서버 인증" });
  throw new Error(`unexpected URL: ${href}`);
};

try {
  assert.equal((await loadNeisStatus()).configured, true);
  const schools = await searchSchools("공주마이스터");
  assert.equal(schools.schools[0].schoolCode, "8140347");
  const timetable = await loadSchoolTimetable({ officeCode: "N10", schoolCode: "8140347", schoolKind: "고등학교", grade: "1", classNo: "1", from: "2026-09-07", to: "2026-09-11" });
  assert.equal(timetable.lessons[0].subject, "전기기기");
  assert.equal(timetable.teacherDataAvailable, false, "공식 시간표 응답에는 교사명이 없음을 명시해야 합니다.");
  const meals = await loadSchoolMeals({ officeCode: "N10", schoolCode: "8140347", from: "2026-09-07", to: "2026-09-13" });
  assert.deepEqual(meals.meals[0].dishes, ["쌀밥", "김치(9)"]);
  assert.ok(requestedUrls.every((url) => url.startsWith("/api/neis/")), "브라우저는 나이스 원격 주소를 직접 호출하면 안 됩니다.");

  const clientSource = await readFile(new URL("../src/utils/schoolApi.js", import.meta.url), "utf8");
  const serverSource = await readFile(new URL("../server/server.mjs", import.meta.url), "utf8");
  assert.ok(!clientSource.includes("open.neis.go.kr"), "인증키를 보호하기 위해 나이스 호출은 서버에서만 해야 합니다.");
  assert.ok(serverSource.includes("KEY: neisApiKey"), "서버의 공식 나이스 요청에 인증키가 포함되어야 합니다.");
  assert.ok(serverSource.includes("neis_key_missing"), "서버에서 인증키 누락을 구분해야 합니다.");
  assert.ok(serverSource.includes("https-http1-ipv4"), "Render 호환 IPv4 HTTP/1.1 전송 경로가 있어야 합니다.");
  assert.ok(serverSource.includes("curl-http2-ipv4"), "NEIS 장애 시 curl HTTP/2 대체 경로가 있어야 합니다.");
  assert.ok(serverSource.includes("NEIS API key configured=${Boolean(neisApiKey)}"), "시작 로그에서 NEIS 키 설정 여부를 별도로 확인할 수 있어야 합니다.");
  assert.ok(!serverSource.includes("console.log(neisApiKey)"), "NEIS 인증키는 서버 로그에 출력하면 안 됩니다.");

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
