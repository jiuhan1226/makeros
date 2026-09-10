import { useEffect, useMemo, useState } from "react";
import { normalizePartnerState } from "../utils/aiPartner";
import { loadSchoolTimetable, searchSchools } from "../utils/schoolApi";

const DAYS = [{ key: "mon", label: "월" }, { key: "tue", label: "화" }, { key: "wed", label: "수" }, { key: "thu", label: "목" }, { key: "fri", label: "금" }];
const DAY_KEYS = { 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri" };
const DEFAULT_PERIOD_COUNT = 8;
const SUBJECT_COLORS = ["#eaf7ff", "#f1edff", "#edf9f2", "#fff3e9", "#fff0f3", "#eef2ff"];

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function weekRange(cursor) {
  const base = new Date(cursor);
  base.setHours(12, 0, 0, 0);
  const offset = base.getDay() === 0 ? -6 : 1 - base.getDay();
  const monday = new Date(base); monday.setDate(base.getDate() + offset);
  const friday = new Date(monday); friday.setDate(monday.getDate() + 4);
  return { from: isoDate(monday), to: isoDate(friday), monday, friday };
}

function cacheKey(schoolCode, weekStart, grade, classNo) {
  return `${schoolCode}:${weekStart}:${grade}-${classNo}`;
}

function teacherKey(schoolCode, grade, classNo, day, periodIndex) {
  return `${schoolCode}:${grade}:${classNo}:${day}:${periodIndex}`;
}

function parseNeisDate(value) {
  const text = String(value || "");
  return text.length === 8 ? new Date(Number(text.slice(0, 4)), Number(text.slice(4, 6)) - 1, Number(text.slice(6, 8)), 12) : null;
}

function colorForSubject(subject) {
  const text = String(subject || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
}

export default function TimetablePage({ state, onChange, onNavigate }) {
  const normalized = useMemo(() => normalizePartnerState(state), [state]);
  const timetable = normalized.timetable;
  const [grade, setGrade] = useState(String(timetable.grade || "1"));
  const [classNo, setClassNo] = useState(String(timetable.classNo || "1"));
  const [weekCursor, setWeekCursor] = useState(() => new Date());
  const [view, setView] = useState("class");
  const [schoolQuery, setSchoolQuery] = useState(timetable.schoolName || "");
  const [schoolResults, setSchoolResults] = useState([]);
  const [schoolBusy, setSchoolBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const week = useMemo(() => weekRange(weekCursor), [weekCursor]);
  const key = cacheKey(timetable.schoolCode, week.from, grade, classNo);
  const record = timetable.schedules?.[key] || { cells: {}, loadedAt: 0 };
  const schedule = record.cells || {};
  const todayKey = DAY_KEYS[new Date().getDay()];

  const teacherNames = useMemo(() => [...new Set(Object.entries(timetable.teacherAssignments || {})
    .filter(([assignmentKey, name]) => assignmentKey.startsWith(`${timetable.schoolCode}:`) && String(name || "").trim())
    .map(([, name]) => String(name).trim()))].sort((a, b) => a.localeCompare(b, "ko")), [timetable.schoolCode, timetable.teacherAssignments]);

  useEffect(() => {
    if (!selectedTeacher || !teacherNames.includes(selectedTeacher)) setSelectedTeacher(teacherNames[0] || "");
  }, [selectedTeacher, teacherNames]);

  useEffect(() => {
    if (timetable.officeCode && timetable.schoolCode) refreshTimetable(false);
  }, [timetable.officeCode, timetable.schoolCode, timetable.schoolKind, grade, classNo, week.from]);

  function updateTimetable(patch) {
    onChange?.({ ...normalized, timetable: { ...timetable, ...patch, updatedAt: Date.now() }, lastUpdatedAt: Date.now() });
  }

  async function findSchools() {
    const query = schoolQuery.trim();
    if (query.length < 2) { setError("학교 이름을 두 글자 이상 입력해 주세요."); return; }
    setSchoolBusy(true); setError("");
    try {
      const result = await searchSchools(query);
      setSchoolResults(result.schools || []);
      if (!result.schools?.length) setError("검색된 학교가 없습니다. 학교 이름을 다시 확인해 주세요.");
    } catch (requestError) { setError(requestError.message); }
    finally { setSchoolBusy(false); }
  }

  function selectSchool(school) {
    setSchoolQuery(school.schoolName);
    setSchoolResults([]);
    updateTimetable({
      officeCode: school.officeCode,
      officeName: school.officeName,
      schoolCode: school.schoolCode,
      schoolName: school.schoolName,
      schoolKind: school.schoolKind,
      region: school.region,
      address: school.address,
      grade: "1",
      classNo: "1",
    });
    setGrade("1"); setClassNo("1"); setSelectedTeacher("");
  }

  async function refreshTimetable(force = true) {
    if (!force && record.loadedAt && Date.now() - record.loadedAt < 5 * 60 * 1000) return;
    setBusy(true); setError("");
    try {
      const result = await loadSchoolTimetable({
        officeCode: timetable.officeCode,
        schoolCode: timetable.schoolCode,
        schoolKind: timetable.schoolKind,
        grade,
        classNo,
        from: week.from,
        to: week.to,
      });
      const cells = {};
      for (const lesson of result.lessons || []) {
        const date = parseNeisDate(lesson.date);
        const day = date ? DAY_KEYS[date.getDay()] : "";
        const periodIndex = Number(lesson.period) - 1;
        if (!day || periodIndex < 0) continue;
        const assignment = timetable.teacherAssignments?.[teacherKey(timetable.schoolCode, grade, classNo, day, periodIndex)] || "";
        cells[`${day}-${periodIndex}`] = { ...lesson, teacher: assignment, live: true };
      }
      updateTimetable({
        grade,
        classNo,
        weekLabel: `${week.from} ~ ${week.to}`,
        schedules: { ...timetable.schedules, [key]: { cells, weekStart: week.from, weekEnd: week.to, grade, classNo, schoolCode: timetable.schoolCode, loadedAt: result.loadedAt || Date.now(), source: result.source } },
      });
      if (!Object.keys(cells).length) setError("선택한 주의 시간표가 없습니다. 학년·반 또는 조회 주간을 확인해 주세요.");
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  function moveWeek(amount) {
    setWeekCursor((current) => { const next = new Date(current); next.setDate(next.getDate() + amount * 7); return next; });
  }

  function openCell(day, periodIndex) {
    const value = schedule[`${day}-${periodIndex}`] || {};
    setEditor({ day, periodIndex, subject: value.subject || "", teacher: value.teacher || "", classLabel: `${grade}학년 ${classNo}반` });
  }

  function saveCell() {
    const cellKey = `${editor.day}-${editor.periodIndex}`;
    const cells = { ...schedule, [cellKey]: { ...(schedule[cellKey] || {}), subject: editor.subject.trim(), teacher: editor.teacher.trim(), manuallyEdited: true } };
    if (!editor.subject.trim() && !editor.teacher.trim()) delete cells[cellKey];
    const assignmentId = teacherKey(timetable.schoolCode, grade, classNo, editor.day, editor.periodIndex);
    const teacherAssignments = { ...timetable.teacherAssignments };
    if (editor.teacher.trim()) teacherAssignments[assignmentId] = editor.teacher.trim(); else delete teacherAssignments[assignmentId];
    updateTimetable({
      grade,
      classNo,
      teacherAssignments,
      schedules: { ...timetable.schedules, [key]: { ...record, cells, weekStart: week.from, weekEnd: week.to, grade, classNo, schoolCode: timetable.schoolCode, loadedAt: Date.now() } },
    });
    setEditor(null);
  }

  const teacherSchedule = useMemo(() => {
    const output = {};
    if (!selectedTeacher) return output;
    Object.values(timetable.schedules || {}).forEach((saved) => {
      if (saved?.schoolCode !== timetable.schoolCode || saved?.weekStart !== week.from) return;
      Object.entries(saved.cells || {}).forEach(([cellKey, lesson]) => {
        if (String(lesson.teacher || "").trim() !== selectedTeacher) return;
        output[cellKey] = { ...lesson, classLabel: `${saved.grade}학년 ${saved.classNo}반` };
      });
    });
    return output;
  }, [selectedTeacher, timetable.schoolCode, timetable.schedules, week.from]);

  const visibleSchedule = view === "teacher" ? teacherSchedule : schedule;
  const periodCount = Math.max(DEFAULT_PERIOD_COUNT, ...Object.keys(visibleSchedule).map((cellKey) => Number(cellKey.split("-").at(-1)) + 1).filter(Number.isFinite));
  const periods = Array.from({ length: periodCount }, (_, index) => index);
  const grades = timetable.schoolKind?.includes("초등") ? [1, 2, 3, 4, 5, 6] : [1, 2, 3];
  const todayLessons = periods.map((periodIndex) => ({ periodIndex, ...(visibleSchedule[`${todayKey}-${periodIndex}`] || {}) })).filter((item) => item.subject);

  return <main className="partner-page timetable-page">
    <nav className="school-life-tabs" aria-label="학교 생활 메뉴"><button onClick={() => onNavigate("partnerCalendar")}>월간 일정</button><button className="active">학교 시간표</button><button onClick={() => onNavigate("meals")}>급식</button></nav>
    <section className="partner-page-head"><div><span className="partner-kicker">LIVE SCHOOL DATA</span><h1>학교 시간표</h1><p>학교를 검색하면 나이스 교육정보에서 선택한 주의 시간표를 가져옵니다.</p></div><button className="partner-secondary" onClick={() => refreshTimetable(true)} disabled={busy}>{busy ? "불러오는 중…" : "새로고침"}</button></section>

    <section className="partner-panel school-picker">
      <div><label htmlFor="school-search">학교 검색</label><div><input id="school-search" value={schoolQuery} onChange={(event) => setSchoolQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && findSchools()} placeholder="예: 공주마이스터고등학교"/><button className="primary" onClick={findSchools} disabled={schoolBusy}>{schoolBusy ? "검색 중…" : "검색"}</button></div></div>
      <aside><strong>{timetable.schoolName}</strong><span>{timetable.region || timetable.officeName} · {timetable.schoolKind}</span></aside>
      {!!schoolResults.length && <div className="school-search-results">{schoolResults.map((school) => <button key={`${school.officeCode}:${school.schoolCode}`} onClick={() => selectSchool(school)}><strong>{school.schoolName}</strong><span>{school.region} · {school.schoolKind}</span><small>{school.address}</small></button>)}</div>}
    </section>

    <section className="timetable-layout">
      <section className="partner-panel timetable-board">
        <header className="timetable-toolbar live">
          <div className="timetable-week-control"><button onClick={() => moveWeek(-1)} aria-label="이전 주">‹</button><div><strong>{week.from} ~ {week.to}</strong><small>{record.loadedAt ? `최근 조회 ${new Date(record.loadedAt).toLocaleString("ko-KR")}` : "실시간 조회 전"}</small></div><button onClick={() => moveWeek(1)} aria-label="다음 주">›</button></div>
          <div className="timetable-view-tabs"><button className={view === "class" ? "active" : ""} onClick={() => setView("class")}>학급별</button><button className={view === "teacher" ? "active" : ""} onClick={() => setView("teacher")}>선생님별</button></div>
          {view === "class" ? <><label>학년<select value={grade} onChange={(event) => setGrade(event.target.value)}>{grades.map((value) => <option key={value} value={value}>{value}학년</option>)}</select></label><label>반<select value={classNo} onChange={(event) => setClassNo(event.target.value)}>{Array.from({ length: 20 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}반</option>)}</select></label></> : <label className="teacher-select">선생님<select value={selectedTeacher} onChange={(event) => setSelectedTeacher(event.target.value)}><option value="">선생님 선택</option>{teacherNames.map((name) => <option key={name}>{name}</option>)}</select></label>}
        </header>
        {view === "teacher" && <div className="teacher-data-notice"><strong>선생님별 시간표 안내</strong><span>나이스 API는 교사명을 제공하지 않습니다. 학급별 시간표에서 수업을 눌러 선생님 이름을 입력하면, 저장된 학급을 모아 선생님별로 보여 줍니다.</span></div>}
        {error && <p className="school-api-error" role="alert">{error}</p>}
        <div className="timetable-scroll"><div className="timetable-grid" role="table" aria-label={view === "class" ? `${grade}학년 ${classNo}반 주간 시간표` : `${selectedTeacher || "선생님"} 주간 시간표`}>
          <div className="timetable-corner" role="columnheader">교시</div>{DAYS.map((day) => <div className={`timetable-day ${todayKey === day.key ? "today" : ""}`} role="columnheader" key={day.key}>{day.label}</div>)}
          {periods.map((periodIndex) => <div className="timetable-row" role="row" key={periodIndex}><div className="timetable-period" role="rowheader"><strong>{periodIndex + 1}교시</strong><small>수업 시간은 학교별 상이</small></div>{DAYS.map((day) => { const lesson = visibleSchedule[`${day.key}-${periodIndex}`] || {}; return <button type="button" className="timetable-cell" style={lesson.subject ? { backgroundColor: colorForSubject(lesson.subject) } : undefined} key={day.key} onClick={() => view === "class" && openCell(day.key, periodIndex)} disabled={view === "teacher"} aria-label={`${day.label}요일 ${periodIndex + 1}교시 ${lesson.subject || "빈 교시"}`}>{lesson.subject ? <><strong>{lesson.subject}</strong><small>{view === "teacher" ? lesson.classLabel : lesson.teacher || "선생님 입력"}</small>{lesson.live && <em className="live-badge">LIVE</em>}</> : <span>{view === "class" ? "＋" : "-"}</span>}</button>; })}</div>)}
        </div></div>
        {!busy && !Object.keys(visibleSchedule).length && <div className="timetable-empty"><strong>{view === "teacher" ? "표시할 선생님 시간표가 없어요." : "선택한 주의 시간표가 없어요."}</strong><p>{view === "teacher" ? "학급별 시간표에서 선생님 이름을 먼저 등록해 주세요." : "학년·반을 확인하거나 새로고침해 주세요."}</p></div>}
      </section>
      <aside className="partner-panel timetable-today"><span className="partner-kicker">TODAY CLASS</span><h2>{view === "teacher" ? selectedTeacher || "선생님" : `${grade}학년 ${classNo}반`}</h2><p>오늘 수업만 빠르게 확인하세요.</p><div>{todayLessons.map((lesson) => <article key={lesson.periodIndex}><span>{lesson.periodIndex + 1}교시</span><strong>{lesson.subject}</strong><small>{view === "teacher" ? lesson.classLabel : lesson.teacher}</small></article>)}{!todayLessons.length && <div className="partner-empty compact">오늘 등록된 수업이 없습니다.</div>}</div><button className="partner-primary full" onClick={() => onNavigate("partnerToday")}>오늘 공부 보기</button></aside>
    </section>

    {editor && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setEditor(null)}><section className="modal timetable-editor" role="dialog" aria-modal="true" aria-labelledby="timetable-editor-title"><button className="modal-close" onClick={() => setEditor(null)} aria-label="닫기">×</button><span className="partner-kicker">CLASS</span><h2 id="timetable-editor-title">{DAYS.find((day) => day.key === editor.day)?.label}요일 {editor.periodIndex + 1}교시</h2><label>과목<input value={editor.subject} onChange={(event) => setEditor({ ...editor, subject: event.target.value })} placeholder="예: 전기기기"/></label><label>선생님<input value={editor.teacher} onChange={(event) => setEditor({ ...editor, teacher: event.target.value })} placeholder="교사명은 나이스 API에 없어 직접 입력합니다." autoFocus/></label><div className="asset-edit-actions"><button className="secondary" onClick={() => setEditor(null)}>취소</button><button className="primary" onClick={saveCell}>저장</button></div></section></div>}
  </main>;
}
