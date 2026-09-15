import assert from "node:assert/strict";
import { findTimetableOverride, mergeTimetableOverrides, removeTimetableOverride, saveTimetableOverride } from "../src/utils/timetableOverrides.js";

const context = { schoolCode: "8140347", grade: "1", classNo: "1", weekStart: "2026-09-14", day: "mon", periodIndex: 0 };
const base = { "mon-0": { subject: "전기회로", teacher: "이선생", live: true } };
let overrides = saveTimetableOverride({}, context, { subject: "전기기기", teacher: "김선생", scope: "recurring" });
let merged = mergeTimetableOverrides(base, overrides, context);
assert.equal(merged["mon-0"].subject, "전기기기");
assert.equal(merged["mon-0"].locked, true);
assert.equal(findTimetableOverride(overrides, context).scope, "recurring");

overrides = saveTimetableOverride(overrides, context, { subject: "자동화", teacher: "박선생", scope: "week" });
merged = mergeTimetableOverrides(base, overrides, context);
assert.equal(merged["mon-0"].subject, "자동화", "이 주만 수정이 매주 수정보다 우선해야 합니다.");
const otherWeek = mergeTimetableOverrides(base, overrides, { ...context, weekStart: "2026-09-21" });
assert.equal(otherWeek["mon-0"].subject, "전기기기", "주간 수정은 다른 주에 적용되면 안 됩니다.");

overrides = removeTimetableOverride(overrides, context, "week");
assert.equal(mergeTimetableOverrides(base, overrides, context)["mon-0"].subject, "전기기기");
const cleared = saveTimetableOverride({}, context, { subject: "", teacher: "", scope: "week" });
assert.equal(mergeTimetableOverrides(base, cleared, context)["mon-0"], undefined, "빈 교시 고정도 보존해야 합니다.");
console.log("[timetable-overrides-test] OK");
