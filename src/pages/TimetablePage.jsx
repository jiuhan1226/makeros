import { useMemo, useState } from "react";
import { normalizePartnerState } from "../utils/aiPartner";

const SOURCE_URL = "https://timetable.s2h9.dev/?sc=85318";
const DAYS = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
];
const PERIODS = ["08:50", "09:50", "10:50", "11:50", "13:30", "14:30", "15:30", "16:30"];
const SUBJECT_COLORS = ["#eaf7ff", "#f1edff", "#edf9f2", "#fff3e9", "#fff0f3", "#eef2ff"];

const SAMPLE_SCHEDULE = {
  "mon-0": { subject: "자로", teacher: "송은", changed: true }, "tue-0": { subject: "자로", teacher: "송은" }, "wed-0": { subject: "센서", teacher: "황인" }, "thu-0": { subject: "정보", teacher: "박진" }, "fri-0": { subject: "한국", teacher: "박서" },
  "mon-1": { subject: "자로", teacher: "송은", changed: true }, "tue-1": { subject: "자로", teacher: "송은", changed: true }, "wed-1": { subject: "센서", teacher: "황인" }, "thu-1": { subject: "정보", teacher: "박진" }, "fri-1": { subject: "진로", teacher: "손정" },
  "mon-2": { subject: "정보", teacher: "박진" }, "tue-2": { subject: "수학", teacher: "이상" }, "wed-2": { subject: "영어", teacher: "이지", changed: true }, "thu-2": { subject: "자로", teacher: "송은" }, "fri-2": { subject: "자로", teacher: "권선", changed: true },
  "mon-3": { subject: "정보", teacher: "박진" }, "tue-3": { subject: "음악", teacher: "김성" }, "wed-3": { subject: "영어", teacher: "강윤", changed: true }, "thu-3": { subject: "자로", teacher: "송은" }, "fri-3": { subject: "수학", teacher: "이상" },
  "mon-4": { subject: "자로", teacher: "권선" }, "tue-4": { subject: "한국", teacher: "박서" }, "wed-4": { subject: "한국", teacher: "박서", changed: true }, "thu-4": { subject: "수학", teacher: "이상" }, "fri-4": { subject: "음악", teacher: "김성" },
  "mon-5": { subject: "자로", teacher: "권선" }, "tue-5": { subject: "체육", teacher: "김용" }, "wed-5": { subject: "창체", teacher: "이상", changed: true }, "thu-5": { subject: "영어", teacher: "강윤" },
  "mon-6": { subject: "자로", teacher: "권선" }, "tue-6": { subject: "영어", teacher: "이지" }, "thu-6": { subject: "체육", teacher: "김용" },
};

function scheduleKey(grade, classNo) {
  return `${grade}-${classNo}`;
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
  const [editor, setEditor] = useState(null);
  const key = scheduleKey(grade, classNo);
  const savedSchedule = timetable.schedules?.[key];
  const schedule = savedSchedule || (key === "1-1" ? SAMPLE_SCHEDULE : {});
  const isSample = !savedSchedule && key === "1-1";
  const todayIndex = new Date().getDay() - 1;
  const todayDay = DAYS[todayIndex] || null;
  const todayLessons = todayDay ? PERIODS.map((time, index) => ({ time, ...(schedule[`${todayDay.key}-${index}`] || {}) })).filter((item) => item.subject) : [];

  function saveTimetable(nextSchedules, overrides = {}) {
    onChange?.({
      ...normalized,
      timetable: {
        ...timetable,
        schoolCode: "85318",
        schoolName: "공주마이스터고등학교",
        grade,
        classNo,
        schedules: nextSchedules,
        updatedAt: Date.now(),
        ...overrides,
      },
      lastUpdatedAt: Date.now(),
    });
  }

  function importSample() {
    saveTimetable({ ...timetable.schedules, [key]: { ...SAMPLE_SCHEDULE } }, { weekLabel: "2026.09.07 ~ 2026.09.11 참고" });
  }

  function openCell(day, periodIndex) {
    const cellKey = `${day}-${periodIndex}`;
    const value = schedule[cellKey] || {};
    setEditor({ cellKey, day, periodIndex, subject: value.subject || "", teacher: value.teacher || "", changed: Boolean(value.changed) });
  }

  function saveCell() {
    const nextSchedule = { ...schedule };
    const subject = String(editor.subject || "").trim();
    const teacher = String(editor.teacher || "").trim();
    if (!subject && !teacher) delete nextSchedule[editor.cellKey];
    else nextSchedule[editor.cellKey] = { subject, teacher, changed: Boolean(editor.changed) };
    saveTimetable({ ...timetable.schedules, [key]: nextSchedule });
    setEditor(null);
  }

  return <main className="partner-page timetable-page">
    <section className="partner-page-head"><div><span className="partner-kicker">ONE TIMETABLE</span><h1>학교 시간표</h1><p>수업 시간을 한눈에 확인하고, 바뀐 교시는 직접 눌러 수정하세요.</p></div><div className="timetable-head-actions"><button className="partner-secondary" onClick={() => onNavigate("partnerCalendar")}>월간 캘린더</button><a className="partner-secondary" href={SOURCE_URL} target="_blank" rel="noreferrer">최신 학교 시간표</a></div></section>

    <section className="timetable-layout">
      <section className="partner-panel timetable-board">
        <header className="timetable-toolbar">
          <div><strong>{timetable.schoolName || "공주마이스터고등학교"}</strong><small>{timetable.weekLabel || (isSample ? "2026.09.07 ~ 2026.09.11 참고 시간표" : "내가 저장한 시간표")}</small></div>
          <label>학년<select value={grade} onChange={(event) => setGrade(event.target.value)}>{[1, 2, 3].map((value) => <option key={value} value={value}>{value}학년</option>)}</select></label>
          <label>반<select value={classNo} onChange={(event) => setClassNo(event.target.value)}>{[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}반</option>)}</select></label>
          {key === "1-1" && <button className="partner-secondary" onClick={importSample}>{isSample ? "참고 시간표 저장" : "참고 시간표로 초기화"}</button>}
        </header>
        <div className="timetable-scroll">
          <div className="timetable-grid" role="table" aria-label={`${grade}학년 ${classNo}반 주간 시간표`}>
            <div className="timetable-corner" role="columnheader">교시</div>
            {DAYS.map((day) => <div className={`timetable-day ${todayDay?.key === day.key ? "today" : ""}`} role="columnheader" key={day.key}>{day.label}</div>)}
            {PERIODS.map((time, periodIndex) => <div className="timetable-row" role="row" key={time}>
              <div className="timetable-period" role="rowheader"><strong>{periodIndex + 1}교시</strong><small>{time}</small></div>
              {DAYS.map((day) => {
                const lesson = schedule[`${day.key}-${periodIndex}`] || {};
                return <button type="button" className={`timetable-cell ${lesson.changed ? "changed" : ""}`} style={lesson.subject ? { backgroundColor: colorForSubject(lesson.subject) } : undefined} key={day.key} onClick={() => openCell(day.key, periodIndex)} aria-label={`${day.label}요일 ${periodIndex + 1}교시 ${lesson.subject || "빈 교시"}`}>
                  {lesson.subject ? <><strong>{lesson.subject}</strong><small>{lesson.teacher}</small>{lesson.changed && <em>변동</em>}</> : <span>＋</span>}
                </button>;
              })}
            </div>)}
          </div>
        </div>
        {!Object.keys(schedule).length && <div className="timetable-empty"><strong>아직 저장된 시간표가 없어요.</strong><p>각 교시를 눌러 과목과 선생님을 입력하세요.</p></div>}
      </section>

      <aside className="partner-panel timetable-today">
        <span className="partner-kicker">TODAY CLASS</span><h2>{todayDay ? `${todayDay.label}요일 수업` : "다음 수업"}</h2><p>{grade}학년 {classNo}반 · 수업이 끝난 뒤 공부 계획을 확인하세요.</p>
        <div>{todayLessons.map((lesson, index) => <article key={`${lesson.time}-${index}`}><span>{lesson.time}</span><strong>{lesson.subject}</strong><small>{lesson.teacher}</small></article>)}{!todayLessons.length && <div className="partner-empty compact">오늘 등록된 수업이 없습니다.</div>}</div>
        <button className="partner-primary full" onClick={() => onNavigate("partnerToday")}>오늘 공부 보기</button>
      </aside>
    </section>

    {editor && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setEditor(null)}><section className="modal timetable-editor" role="dialog" aria-modal="true" aria-labelledby="timetable-editor-title"><button className="modal-close" onClick={() => setEditor(null)} aria-label="닫기">×</button><span className="partner-kicker">CLASS</span><h2 id="timetable-editor-title">{DAYS.find((day) => day.key === editor.day)?.label}요일 {editor.periodIndex + 1}교시</h2><label>과목<input value={editor.subject} onChange={(event) => setEditor({ ...editor, subject: event.target.value })} placeholder="예: 전기기기" autoFocus/></label><label>선생님<input value={editor.teacher} onChange={(event) => setEditor({ ...editor, teacher: event.target.value })} placeholder="예: 김선생"/></label><label className="partner-single-day-check"><input type="checkbox" checked={editor.changed} onChange={(event) => setEditor({ ...editor, changed: event.target.checked })}/> 이번 주 변동 수업</label><div className="asset-edit-actions"><button className="secondary" onClick={() => setEditor(null)}>취소</button><button className="primary" onClick={saveCell}>저장</button></div></section></div>}
  </main>;
}
