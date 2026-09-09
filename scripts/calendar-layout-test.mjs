import assert from "node:assert/strict";
import { buildCalendarLaneMap } from "../src/utils/calendarLayout.js";

const items = [
  { id: "electric:08", rangeKey: "electric", title: "전기", rangeStart: "2026-09-08", rangeEnd: "2026-09-15" },
  { id: "skills:09", rangeKey: "skills", title: "기능사", rangeStart: "2026-09-09", rangeEnd: "2026-09-30" },
  { id: "single:16", rangeKey: "single", title: "내신", rangeStart: "2026-09-16", rangeEnd: "2026-09-16" },
];

const lanes = buildCalendarLaneMap(items);
assert.equal(lanes.get("electric"), 0, "먼저 시작한 일정은 첫 줄을 사용해야 합니다.");
assert.equal(lanes.get("skills"), 1, "겹치는 기간 일정은 다른 줄을 사용해야 합니다.");
assert.equal(lanes.get("single"), 0, "끝난 일정의 줄은 다음 일정이 다시 사용할 수 있어야 합니다.");
console.log("calendar layout tests passed");
