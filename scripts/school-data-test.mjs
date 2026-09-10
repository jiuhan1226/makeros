import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadNeisStatus, loadSchoolDataStatus, loadSchoolMeals, loadSchoolTimetable, searchSchools } from "../src/utils/schoolApi.js";
import { currentSeoulSchoolWeek, flattenComciganTimetable, isCurrentSeoulSchoolWeek, mapComciganLessonsToWeek } from "../server/comciganProvider.mjs";
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
  if (href.startsWith("/api/school-data/status")) return response({ timetablePrimary: "Comcigan", timetableFallback: "NEIS Open API", comciganEnabled: true });
  if (href.startsWith("/api/school-data/schools")) return response({ schools: [{ officeCode: "N10", officeName: "충청남도교육청", schoolCode: "8140347", comciganCode: "85318", schoolName: "공주마이스터고등학교", schoolKind: "고등학교", region: "충청남도", address: "공주시 주소" }], source: "NEIS 학교 검색" });
  if (href.startsWith("/api/school-data/timetable")) return response({ lessons: [{ date: "20260910", grade: "1", classNo: "1", period: 2, subject: "전기기기", department: "전기전자과", teacher: "김선생" }], allLessons: [{ date: "20260910", grade: "1", classNo: "1", period: 2, subject: "전기기기", teacher: "김선생" }], teacherDataAvailable: true, provider: "comcigan", source: "컴시간 실시간" });
  if (href.startsWith("/api/neis/meals")) return response({ meals: [{ date: "20260910", type: "중식", dishes: ["쌀밥", "김치(9)"], calories: "700 Kcal", nutrition: ["탄수화물 : 100g"], origin: "쌀 : 국내산" }], source: "NEIS 공식 Open API · 서버 인증" });
  throw new Error(`unexpected URL: ${href}`);
};

try {
  assert.equal((await loadNeisStatus()).configured, true);
  assert.equal((await loadSchoolDataStatus()).timetablePrimary, "Comcigan");
  const schools = await searchSchools("공주마이스터");
  assert.equal(schools.schools[0].schoolCode, "8140347");
  const timetable = await loadSchoolTimetable({ officeCode: "N10", schoolCode: "8140347", schoolKind: "고등학교", grade: "1", classNo: "1", from: "2026-09-07", to: "2026-09-11" });
  assert.equal(timetable.lessons[0].subject, "전기기기");
  assert.equal(timetable.teacherDataAvailable, true, "컴시간 시간표의 교사명을 사용할 수 있어야 합니다.");
  assert.equal(timetable.provider, "comcigan");
  const meals = await loadSchoolMeals({ officeCode: "N10", schoolCode: "8140347", from: "2026-09-07", to: "2026-09-13" });
  assert.deepEqual(meals.meals[0].dishes, ["쌀밥", "김치(9)"]);
  assert.ok(requestedUrls.every((url) => url.startsWith("/api/neis/") || url.startsWith("/api/school-data/")), "브라우저는 학교 데이터 원격 주소를 직접 호출하면 안 됩니다.");

  const currentWeek = currentSeoulSchoolWeek(new Date("2026-09-10T03:00:00Z"));
  assert.deepEqual(currentWeek, { from: "2026-09-07", to: "2026-09-11" });
  assert.equal(isCurrentSeoulSchoolWeek("2026-09-07", "2026-09-11", new Date("2026-09-10T03:00:00Z")), true);
  const flattened = flattenComciganTimetable({
    1: {
      1: [[{ grade: 1, class: 1, classTime: 1, subject: "전기기기", teacher: "김선생", changed: true }], [], [], [], []],
      2: [[{ grade: 1, class: 2, classTime: 1, subject: "전기회로", teacher: "이선생" }], [], [], [], []],
    },
  });
  assert.equal(flattened.classCounts["1"], 2, "컴시간의 학년별 반 수를 계산해야 합니다.");
  assert.equal(flattened.lessons[0].changed, true, "컴시간의 변경 수업 표시를 보존해야 합니다.");
  const mapped = mapComciganLessonsToWeek(flattened.lessons, "2026-09-07");
  assert.equal(mapped[0].date, "20260907", "컴시간 요일을 조회 주의 실제 날짜로 변환해야 합니다.");
  assert.equal(mapped[1].teacher, "이선생", "모든 학급의 교사명을 보존해야 합니다.");

  const clientSource = await readFile(new URL("../src/utils/schoolApi.js", import.meta.url), "utf8");
  const serverSource = await readFile(new URL("../server/server.mjs", import.meta.url), "utf8");
  assert.ok(!clientSource.includes("open.neis.go.kr"), "인증키를 보호하기 위해 나이스 호출은 서버에서만 해야 합니다.");
  assert.ok(serverSource.includes("KEY: neisApiKey"), "서버의 공식 나이스 요청에 인증키가 포함되어야 합니다.");
  assert.ok(serverSource.includes("neis_key_missing"), "서버에서 인증키 누락을 구분해야 합니다.");
  assert.ok(serverSource.includes("https-http1-ipv4"), "Render 호환 IPv4 HTTP/1.1 전송 경로가 있어야 합니다.");
  assert.ok(serverSource.includes("curl-http2-ipv4"), "NEIS 장애 시 curl HTTP/2 대체 경로가 있어야 합니다.");
  assert.ok(serverSource.includes("NEIS API key configured=${Boolean(neisApiKey)}"), "시작 로그에서 NEIS 키 설정 여부를 별도로 확인할 수 있어야 합니다.");
  assert.ok(serverSource.includes('app.get("/api/school-data/timetable"'), "컴시간 우선 통합 시간표 라우트가 있어야 합니다.");
  assert.ok(serverSource.includes("loadComciganSnapshot"), "서버가 컴시간 시간표 공급자를 사용해야 합니다.");
  assert.ok(serverSource.includes("loadNeisTimetableData"), "컴시간 실패 시 NEIS 시간표 대체 경로가 있어야 합니다.");
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
