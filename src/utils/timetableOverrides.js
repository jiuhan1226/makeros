export function timetableOverrideKey({ schoolCode = "", grade = "1", classNo = "1", day = "mon", periodIndex = 0, weekStart = "", scope = "recurring" }) {
  const range = scope === "week" ? weekStart : "every-week";
  return [schoolCode, grade, classNo, range, day, Number(periodIndex)].map((value) => encodeURIComponent(String(value))).join("|");
}

export function findTimetableOverride(overrides = {}, context = {}) {
  const recurring = overrides[timetableOverrideKey({ ...context, scope: "recurring" })];
  const weekly = overrides[timetableOverrideKey({ ...context, scope: "week" })];
  return weekly || recurring || null;
}

export function mergeTimetableOverrides(cells = {}, overrides = {}, context = {}) {
  const output = { ...(cells || {}) };
  for (const day of ["mon", "tue", "wed", "thu", "fri"]) {
    for (let periodIndex = 0; periodIndex < 16; periodIndex += 1) {
      const cellKey = `${day}-${periodIndex}`;
      const override = findTimetableOverride(overrides, { ...context, day, periodIndex });
      if (!override) continue;
      if (override.cleared) delete output[cellKey];
      else output[cellKey] = { ...(output[cellKey] || {}), subject: override.subject || "", teacher: override.teacher || "", room: override.room || output[cellKey]?.room || "", manuallyEdited: true, locked: true, overrideScope: override.scope || "recurring", overrideUpdatedAt: override.updatedAt || 0 };
    }
  }
  return output;
}

export function saveTimetableOverride(overrides = {}, context = {}, value = {}) {
  const scope = value.scope === "week" ? "week" : "recurring";
  const key = timetableOverrideKey({ ...context, scope });
  return { ...overrides, [key]: { subject: String(value.subject || "").trim(), teacher: String(value.teacher || "").trim(), room: String(value.room || "").trim(), cleared: !String(value.subject || "").trim() && !String(value.teacher || "").trim(), scope, updatedAt: Date.now() } };
}

export function removeTimetableOverride(overrides = {}, context = {}, scope = "recurring") {
  const next = { ...overrides };
  delete next[timetableOverrideKey({ ...context, scope })];
  return next;
}
