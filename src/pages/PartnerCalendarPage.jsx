import React, { useMemo, useState } from "react";
import { daysUntil, normalizePartnerState, partnerCalendarItems, partnerId } from "../utils/aiPartner";

const labels = { academic: "내신", certificate: "자격증", career: "취업", activity: "대회·활동", custom: "개인 일정" };
const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

function parseDate(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day, 12) : null;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function calendarCells(cursor) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const cells = Array(firstDay).fill(null);
  for (let day = 1; day <= lastDate; day += 1) cells.push(new Date(year, month, day, 12));
  while (cells.length % 7) cells.push(null);
  return cells;
}

function rangeSegment(item, date) {
  if (!item.isRange) return { className: "range-single", showTitle: true };
  const key = `${monthKey(date)}-${String(date.getDate()).padStart(2, "0")}`;
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const starts = key === item.rangeStart || date.getDay() === 0 || date.getDate() === 1;
  const ends = key === item.rangeEnd || date.getDay() === 6 || date.getDate() === lastDayOfMonth;
  return {
    className: starts && ends ? "range-single" : starts ? "range-start" : ends ? "range-end" : "range-middle",
    showTitle: starts,
  };
}

export default function PartnerCalendarPage({ state, onChange, onNavigate }) {
  const normalized = useMemo(() => normalizePartnerState(state), [state]);
  const items = useMemo(() => partnerCalendarItems(normalized), [normalized]);
  const [cursor, setCursor] = useState(() => new Date());
  const [editor, setEditor] = useState(null);
  const [editorError, setEditorError] = useState("");
  const cells = useMemo(() => calendarCells(cursor), [cursor]);
  const itemMap = useMemo(() => items.reduce((map, item) => {
    (map[item.date] ||= []).push(item);
    return map;
  }, {}), [items]);
  const upcoming = useMemo(() => {
    const unique = [...new Map(items.map((item) => [item.rangeKey || item.id, item])).values()];
    const future = unique.filter((item) => (daysUntil(item.rangeEnd || item.date) ?? -1) >= 0);
    return (future.length ? future : unique)
      .sort((a, b) => String(a.rangeEnd || a.date).localeCompare(String(b.rangeEnd || b.date)))
      .slice(0, 5);
  }, [items]);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  function moveMonth(amount) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1, 12));
  }

  function showItemMonth(item) {
    const date = parseDate(item.date);
    if (date) setCursor(new Date(date.getFullYear(), date.getMonth(), 1, 12));
  }

  function openEditor(date, item = null) {
    const original = item?.sourceId ? normalized.calendarExtras.find((row) => row.id === item.sourceId) : null;
    const dateKey = typeof date === "string" ? date : `${monthKey(date)}-${String(date.getDate()).padStart(2, "0")}`;
    setEditor({
      id: original?.id || "",
      title: original?.title || "",
      startDate: original?.startDate || original?.date || dateKey,
      endDate: original?.endDate || original?.date || dateKey,
      isSingleDay: Boolean(original?.isSingleDay),
      details: original?.details || "",
    });
    setEditorError("");
  }

  function saveSchedule() {
    const title = String(editor?.title || "").trim();
    if (!title || !editor?.startDate) return setEditorError("일정 이름과 시작일을 입력해 주세요.");
    const endDate = editor.isSingleDay ? editor.startDate : editor.endDate;
    if (!endDate || endDate < editor.startDate) return setEditorError("종료일은 시작일과 같거나 이후여야 합니다.");
    const saved = { ...editor, id: editor.id || partnerId("calendar"), title, date: editor.startDate, endDate };
    const calendarExtras = editor.id
      ? normalized.calendarExtras.map((item) => item.id === editor.id ? saved : item)
      : [...normalized.calendarExtras, saved];
    onChange?.({ ...normalized, calendarExtras, lastUpdatedAt: Date.now() });
    setEditor(null);
  }

  function deleteSchedule() {
    if (!editor?.id) return;
    onChange?.({ ...normalized, calendarExtras: normalized.calendarExtras.filter((item) => item.id !== editor.id), lastUpdatedAt: Date.now() });
    setEditor(null);
  }

  return <main className="partner-page">
    <section className="partner-page-head"><div><span className="partner-kicker">ONE CALENDAR</span><h1>통합 일정</h1><p>내신 시험, 자격증, 취업, 대회 마감을 월간 달력에서 한눈에 확인합니다.</p></div><button className="partner-secondary" onClick={() => onNavigate("partnerGoals")}>일정 정보 수정</button></section>
    <section className="partner-calendar-layout">
      <section className="partner-month-calendar partner-panel">
        <header className="partner-calendar-toolbar">
          <button type="button" aria-label="이전 달" onClick={() => moveMonth(-1)}>‹</button>
          <div><strong>{cursor.getFullYear()}년 {cursor.getMonth() + 1}월</strong><button type="button" onClick={() => setCursor(new Date())}>오늘</button></div>
          <button type="button" aria-label="다음 달" onClick={() => moveMonth(1)}>›</button>
        </header>
        <div className="partner-calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="partner-calendar-grid">
          {cells.map((date, index) => {
            if (!date) return <div className="partner-calendar-cell empty" key={`empty-${index}`} />;
            const key = `${monthKey(date)}-${String(date.getDate()).padStart(2, "0")}`;
            const dayItems = [...(itemMap[key] || [])].sort((a, b) => String(a.rangeKey || a.title).localeCompare(String(b.rangeKey || b.title)));
            return <div className={`partner-calendar-cell ${key === todayKey ? "today" : ""}`} key={key} role="button" tabIndex="0" aria-label={`${key} 일정 추가`} onClick={() => openEditor(date)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openEditor(date); } }}>
              <span className="partner-calendar-day">{date.getDate()}</span>
              <div className="partner-calendar-events">
                {dayItems.slice(0, 3).map((item) => {
                  const segment = rangeSegment(item, date);
                  return <button type="button" key={item.id} className={`${item.type} ${item.isRange ? "range-event" : ""} ${segment.className}`} title={item.title} aria-label={`${item.title} ${item.rangeStart}${item.isRange ? `부터 ${item.rangeEnd}까지` : ""}`} onClick={(event) => { event.stopPropagation(); item.sourceId ? openEditor(item.date, item) : onNavigate("partnerGoals"); }}>
                    {segment.showTitle && <i />}<span>{segment.showTitle ? item.title : "\u00a0"}</span>
                  </button>;
                })}
                {dayItems.length > 3 && <small>+{dayItems.length - 3}개 더보기</small>}
              </div>
            </div>;
          })}
        </div>
        {!items.length && <div className="partner-calendar-empty"><strong>등록된 일정이 없습니다.</strong><p>목표와 시험일을 입력하면 달력에 자동으로 표시됩니다.</p></div>}
      </section>

      <aside className="partner-panel partner-calendar-help partner-upcoming-card">
        <span className="partner-kicker">UPCOMING</span><h2>가까운 일정</h2><p>마감이 가까운 순서로 확인하세요.</p>
        <div className="partner-upcoming-list">
          {upcoming.map((item) => {
            const dueDate = item.rangeEnd || item.date;
            const d = daysUntil(dueDate);
            return <button type="button" key={item.id} onClick={() => showItemMonth(item)}>
              <span className={`partner-upcoming-type ${item.type}`}>{labels[item.type] || item.type}</span>
              <strong>{item.title}</strong>
              <small>{item.isRange ? `${item.rangeStart} ~ ${item.rangeEnd}` : item.date}{item.locked ? " · 고정" : ""}</small>
              <b>{d == null ? "" : d === 0 ? "D-DAY" : d > 0 ? `D-${d}` : `D+${Math.abs(d)}`}</b>
            </button>;
          })}
          {!upcoming.length && <div className="partner-empty compact">등록된 일정이 없습니다.</div>}
        </div>
        <button className="partner-secondary full" onClick={() => onNavigate("partnerGoals")}>일정 추가·수정</button>
      </aside>
    </section>
    {editor && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setEditor(null)}>
      <section className="modal partner-calendar-editor" role="dialog" aria-modal="true" aria-labelledby="calendar-editor-title">
        <button className="modal-close" onClick={() => setEditor(null)} aria-label="닫기">×</button>
        <span className="partner-kicker">SCHEDULE</span><h2 id="calendar-editor-title">{editor.id ? "일정 수정" : "일정 추가"}</h2>
        <label>일정 이름<input value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} placeholder="예: 전기기기 시험 준비" autoFocus /></label>
        <label className="partner-single-day-check"><input type="checkbox" checked={editor.isSingleDay} onChange={(event) => setEditor({ ...editor, isSingleDay: event.target.checked, endDate: event.target.checked ? editor.startDate : editor.endDate })}/> 하루 일정으로 등록</label>
        <div className="partner-calendar-date-fields">
          <label>시작일<input type="date" value={editor.startDate} onChange={(event) => setEditor({ ...editor, startDate: event.target.value, endDate: editor.isSingleDay || editor.endDate < event.target.value ? event.target.value : editor.endDate })}/></label>
          {!editor.isSingleDay && <label>종료일<input type="date" min={editor.startDate} value={editor.endDate} onChange={(event) => setEditor({ ...editor, endDate: event.target.value })}/></label>}
        </div>
        <label>메모<textarea value={editor.details} onChange={(event) => setEditor({ ...editor, details: event.target.value })} placeholder="시간, 준비물 등 필요한 내용을 입력하세요."/></label>
        {editorError && <p className="error-box" role="alert">{editorError}</p>}
        <div className="partner-calendar-editor-actions">{editor.id && <button className="danger-text" onClick={deleteSchedule}>삭제</button>}<button className="secondary" onClick={() => setEditor(null)}>취소</button><button className="primary" onClick={saveSchedule}>저장</button></div>
      </section>
    </div>}
  </main>;
}
