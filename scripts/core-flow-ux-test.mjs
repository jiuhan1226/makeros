import assert from "node:assert/strict";
import fs from "node:fs";

const main = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const goals = fs.readFileSync(new URL("../src/pages/PartnerGoalsPage.jsx", import.meta.url), "utf8");
const today = fs.readFileSync(new URL("../src/pages/PartnerTodayPage.jsx", import.meta.url), "utf8");
const data = fs.readFileSync(new URL("../src/pages/DataManagementPage.jsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

assert.match(main, /activate: !getActivePartnerPlan\(baseState\)/, "first plan should activate and later recalculations should remain pending");
assert.ok((main.match(/createPlanVersion\(next, replanned, \{ activate: false \}\)/g) || []).length >= 2, "CBT and PDF results should create reviewable plan drafts");
assert.equal((goals.match(/내 계획 자동으로 만들기/g) || []).length, 1, "goal setup should expose one primary generation CTA");
assert.match(goals, /partner-optional-profile/);
assert.match(today, /왜 이 일부터\?/);
assert.match(today, /pendingReason/);
assert.match(data, /전체 데이터 내보내기/);
assert.match(data, /학습 기록 삭제/);
assert.match(css, /grid-template-rows:auto minmax\(0,1fr\) 78px/);
assert.match(css, /width:min\(720px,calc\(100% - 36px\)\);height:62px/);

console.log("Core flow UX test passed");
