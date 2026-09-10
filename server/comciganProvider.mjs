import ComciganTimetable from "comcigan-timetable";

const FRESH_CACHE_MS = 3 * 60 * 1000;
const STALE_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 22 * 1000;
const searchCache = new Map();
const timetableCache = new Map();
const timetableInflight = new Map();

function clean(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeSchoolName(value = "") {
  return clean(value).replace(/\s/g, "").replace(/학교$/, "");
}

function timeout(promise, milliseconds = REQUEST_TIMEOUT_MS) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error("컴시간 응답 시간이 초과되었습니다."), { code: "comcigan_timeout" })), milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
}

function makeClient() {
  return new ComciganTimetable();
}

export function currentSeoulSchoolWeek(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now).map((part) => [part.type, part.value]));
  const current = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);
  const day = current.getUTCDay();
  const monday = new Date(current);
  monday.setUTCDate(current.getUTCDate() + (day === 0 ? -6 : 1 - day));
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  return { from: monday.toISOString().slice(0, 10), to: friday.toISOString().slice(0, 10) };
}

export function isCurrentSeoulSchoolWeek(from, to, now = new Date()) {
  const current = currentSeoulSchoolWeek(now);
  return String(from || "") === current.from && String(to || "") === current.to;
}

export function flattenComciganTimetable(timetable = {}) {
  const lessons = [];
  const classCounts = {};
  for (const [gradeKey, classes] of Object.entries(timetable || {})) {
    const grade = Number(gradeKey);
    if (!Number.isInteger(grade) || !classes || typeof classes !== "object") continue;
    const classNumbers = Object.keys(classes).map(Number).filter((value) => Number.isInteger(value) && value > 0);
    classCounts[gradeKey] = classNumbers.length ? Math.max(...classNumbers) : 0;
    for (const [classKey, weekdays] of Object.entries(classes)) {
      const classNo = Number(classKey);
      if (!Number.isInteger(classNo) || !Array.isArray(weekdays)) continue;
      weekdays.forEach((periods, weekdayIndex) => {
        if (!Array.isArray(periods) || weekdayIndex < 0 || weekdayIndex > 4) return;
        periods.forEach((cell, periodIndex) => {
          if (!cell?.subject) return;
          lessons.push({
            grade: String(cell.grade || grade),
            classNo: String(cell.class || classNo),
            weekdayIndex,
            period: Number(cell.classTime || periodIndex + 1),
            subject: clean(cell.subject),
            teacher: clean(cell.teacher),
            room: clean(cell.classRoom),
            changed: Boolean(cell.changed),
          });
        });
      });
    }
  }
  return { lessons, classCounts };
}

export function mapComciganLessonsToWeek(lessons = [], weekStart = "") {
  const monday = /^\d{4}-\d{2}-\d{2}$/.test(String(weekStart)) ? new Date(`${weekStart}T12:00:00Z`) : null;
  return lessons.map((lesson) => {
    const date = monday ? new Date(monday) : null;
    if (date) date.setUTCDate(monday.getUTCDate() + Number(lesson.weekdayIndex || 0));
    return { ...lesson, date: date ? date.toISOString().slice(0, 10).replace(/-/g, "") : "" };
  });
}

export async function searchComciganSchools(query) {
  const keyword = clean(query);
  if (keyword.length < 2) return [];
  const key = normalizeSchoolName(keyword);
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.createdAt < 60 * 60 * 1000) return cached.value;
  const client = makeClient();
  await timeout(client.init({ maxGrade: 6, cache: FRESH_CACHE_MS }));
  const rows = await timeout(client.search(keyword));
  const value = (rows || []).map((school) => ({
    comciganCode: String(school.code || ""),
    schoolName: clean(school.name),
    region: clean(school.region),
  })).filter((school) => school.comciganCode && school.schoolName);
  searchCache.set(key, { createdAt: Date.now(), value });
  return value;
}

export async function resolveComciganSchool({ schoolName, comciganCode }) {
  const supplied = Number(comciganCode);
  if (Number.isInteger(supplied) && supplied > 0) return { comciganCode: String(supplied), schoolName: clean(schoolName) };
  const rows = await searchComciganSchools(schoolName);
  const target = normalizeSchoolName(schoolName);
  const exact = rows.find((school) => normalizeSchoolName(school.schoolName) === target);
  const partial = rows.find((school) => normalizeSchoolName(school.schoolName).includes(target) || target.includes(normalizeSchoolName(school.schoolName)));
  const selected = exact || partial;
  if (!selected) throw Object.assign(new Error("선택한 학교는 컴시간에서 찾을 수 없습니다."), { code: "comcigan_school_not_found" });
  return selected;
}

export async function loadComciganSnapshot({ schoolName, comciganCode, force = false }) {
  const school = await resolveComciganSchool({ schoolName, comciganCode });
  const key = school.comciganCode;
  const cached = timetableCache.get(key);
  if (!force && cached && Date.now() - cached.loadedAt < FRESH_CACHE_MS) return { ...cached, stale: false };
  if (timetableInflight.has(key)) return timetableInflight.get(key);

  const task = (async () => {
    try {
      const client = makeClient();
      await timeout(client.init({ maxGrade: 6, cache: FRESH_CACHE_MS }));
      client.setSchool(Number(key));
      const rawTimetable = await timeout(client.getTimetable());
      const classTimes = await timeout(client.getClassTime());
      const flattened = flattenComciganTimetable(rawTimetable);
      const raw = client.getJsonData?.() || {};
      if (!flattened.lessons.length) throw Object.assign(new Error("컴시간에 등록된 수업이 없습니다."), { code: "comcigan_data_empty" });
      const snapshot = {
        ...school,
        schoolName: clean(raw["학교명"] || school.schoolName),
        lessons: flattened.lessons,
        classCounts: flattened.classCounts,
        classTimes: Array.isArray(classTimes) ? classTimes.map(clean).filter(Boolean) : [],
        sourceUpdatedAt: clean(raw["자료244"] || raw["수정일"] || ""),
        loadedAt: Date.now(),
        stale: false,
      };
      timetableCache.set(key, snapshot);
      return snapshot;
    } catch (error) {
      if (cached && Date.now() - cached.loadedAt < STALE_CACHE_MS) return { ...cached, stale: true, fallbackReason: error?.code || "comcigan_unavailable" };
      throw Object.assign(new Error(error?.message || "컴시간 시간표를 불러오지 못했습니다."), { code: error?.code || "comcigan_unavailable", cause: error });
    } finally {
      timetableInflight.delete(key);
    }
  })();
  timetableInflight.set(key, task);
  return task;
}
