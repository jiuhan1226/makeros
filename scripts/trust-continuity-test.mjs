import assert from "node:assert/strict";
import fs from "node:fs";
import { evidenceLabel, passProjectionDisplay } from "../src/utils/trustLabels.js";
import { buildDeterministicPlan, createDefaultPartnerState, createPlanVersion, getActivePartnerPlan, setPartnerDayOff } from "../src/utils/aiPartner.js";

assert.deepEqual(passProjectionDisplay({ sampleSize: 0 }), { value: "분석 전", detail: "실전 기록 필요", reliable: false });
assert.equal(passProjectionDisplay({ sampleSize: 2, expectedScore: 80, label: "합격권" }).value, "기록 더 필요", "표본이 적을 때 합격 확률처럼 표시하면 안 됩니다.");
assert.equal(passProjectionDisplay({ sampleSize: 5, expectedScore: 74, label: "가능성 있음" }).value, "가능성 있음");
assert.equal(evidenceLabel(0), "근거 없음");
assert.equal(evidenceLabel(4), "연결 기록 4개");

const main = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const firebase = fs.readFileSync(new URL("../src/firebase.js", import.meta.url), "utf8");
const today = fs.readFileSync(new URL("../src/pages/PartnerTodayPage.jsx", import.meta.url), "utf8");
const growth = fs.readFileSync(new URL("../src/pages/GrowthReportPage.jsx", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../server/server.mjs", import.meta.url), "utf8");

for (const token of ["loadCloudWorkspace", "saveCloudWorkspace", "saveCloudPdfLibrary", "opportunityBookmarks"]) {
  assert.ok(main.includes(token), `계정 연속성 연결 누락: ${token}`);
}
for (const token of ["pdfLibrary", "pages", "workspace", "studyAssets", "makerState"]) {
  assert.ok(firebase.includes(token), `클라우드 작업공간 저장 누락: ${token}`);
}
assert.ok(today.includes("items.slice(0, 2)") && today.includes("그다음 할 일"), "오늘 화면은 핵심 2개를 먼저 보여줘야 합니다.");
assert.ok(!growth.includes("`${projection.probability}%`") && growth.includes("실제 시험 합격을 예측하거나 보장하지 않습니다"), "합격 가능성을 검증된 확률처럼 표시하면 안 됩니다.");
assert.ok(!server.includes("AI 해설 일일 한도") && !server.includes("AI 튜터는 하루"), "AI 해설과 튜터의 일일 횟수 제한이 남아 있으면 안 됩니다.");

const planningState = createDefaultPartnerState();
planningState.profile.dayMinutes = { ...planningState.profile.dayMinutes, sun: 90 };
planningState.goals = [{ id: "goal-1", type: "task", title: "전기 이론 복습", deadline: "2026-09-21" }];
const planned = createPlanVersion(planningState, buildDeterministicPlan(planningState, { today: "2026-09-20" }), { activate: true });
const rested = setPartnerDayOff(planned, "2026-09-20", true);
assert.equal(getActivePartnerPlan(rested).today.availableMinutes, 0, "휴식일에는 학습 분량을 배치하면 안 됩니다.");
assert.equal(getActivePartnerPlan(rested).today.items.length, 0, "휴식일의 오늘 할 일은 비워야 합니다.");

console.log("[trust-continuity-test] OK");
