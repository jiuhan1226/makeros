import React, { useMemo, useState } from "react";
import { daysUntil, normalizePartnerState, partnerCalendarItems } from "../utils/aiPartner";

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

export default function PartnerCalendarPage({ state, onNavigate }) {
  const normalized = useMemo(() => normalizePartnerState(state), [state]);
  const items = useMemo(() => partnerCalendarItems(normalized), [normalized]);
  const [cursor, setCursor] = useState(() => new Date());
  const cells = useMemo(() => calendarCells(cursor), [cursor]);
  const itemMap = useMemo(() => items.reduce((map, item) => {
    (map[item.date] ||= []).push(item);
    return map;
  }, {}), [items]);
  const upcoming = useMemo(() => {
    const future = items.filter((item) => (daysUntil(item.date) ?? -1) >= 0);
    return (future.length ? future : items).slice(0, 5);
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
            const dayItems = itemMap[key] || [];
            return <div className={`partner-calendar-cell ${key === todayKey ? "today" : ""}`} key={key}>
              <span className="partner-calendar-day">{date.getDate()}</span>
              <div className="partner-calendar-events">
                {dayItems.slice(0, 3).map((item) => <button type="button" key={item.id} className={item.type} title={item.title} onClick={() => onNavigate("partnerGoals")}><i />{item.title}</button>)}
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
            const d = daysUntil(item.date);
            return <button type="button" key={item.id} onClick={() => showItemMonth(item)}>
              <span className={`partner-upcoming-type ${item.type}`}>{labels[item.type] || item.type}</span>
              <strong>{item.title}</strong>
              <small>{item.date}{item.locked ? " · 고정" : ""}</small>
              <b>{d == null ? "" : d === 0 ? "D-DAY" : d > 0 ? `D-${d}` : `D+${Math.abs(d)}`}</b>
            </button>;
          })}
          {!upcoming.length && <div className="partner-empty compact">등록된 일정이 없습니다.</div>}
        </div>
        <button className="partner-secondary full" onClick={() => onNavigate("partnerGoals")}>일정 추가·수정</button>
      </aside>
    </section>
  </main>;
}
