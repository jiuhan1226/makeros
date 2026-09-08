import React, { useMemo } from "react";
import { daysUntil, normalizePartnerState, partnerCalendarItems } from "../utils/aiPartner";

const labels = { academic: "내신", certificate: "자격증", career: "취업", activity: "대회·활동", custom: "개인 일정" };

export default function PartnerCalendarPage({ state, onNavigate }) {
  const normalized = useMemo(() => normalizePartnerState(state), [state]);
  const items = useMemo(() => partnerCalendarItems(normalized), [normalized]);
  const grouped = useMemo(() => items.reduce((map, item) => { const month = String(item.date || "").slice(0,7) || "미정"; (map[month] ||= []).push(item); return map; }, {}), [items]);

  return <main className="partner-page">
    <section className="partner-page-head"><div><span className="partner-kicker">ONE TIMELINE</span><h1>통합 일정</h1><p>내신 시험, 자격증, 취업, 대회 마감을 한 시간축에서 보고 충돌을 먼저 확인합니다.</p></div><button className="partner-secondary" onClick={() => onNavigate("partnerGoals")}>일정 정보 수정</button></section>
    {!items.length && <section className="partner-panel partner-empty"><strong>등록된 일정이 없습니다.</strong><p>목표와 시험일을 입력하면 이곳에 자동으로 모입니다.</p></section>}
    <section className="partner-calendar-layout">
      <div className="partner-calendar-timeline">
        {Object.entries(grouped).map(([month, monthItems]) => <section key={month} className="partner-month"><header><strong>{month.replace('-', '.')}</strong><span>{monthItems.length}개 일정</span></header><div>{monthItems.map((item) => { const d = daysUntil(item.date); return <article key={item.id}><span className={`partner-calendar-dot ${item.type}`}/><div><span>{labels[item.type] || item.type}</span><strong>{item.title}</strong><small>{item.date} · {item.locked ? "고정 일정" : "계획에 반영"}</small></div><b>{d == null ? "" : d >= 0 ? `D-${d}` : `D+${Math.abs(d)}`}</b></article>; })}</div></section>)}
      </div>
      <aside className="partner-panel partner-calendar-help"><span className="partner-kicker">CONSTRAINT CHECK</span><h2>AI보다 먼저 지키는 것</h2><ul className="partner-principles"><li>학교 고정 일정과 학생이 잠근 일정</li><li>휴식·수면·하루 최대 가능 시간</li><li>시험·접수·제출 마감 이후 배치 금지</li><li>가능 시간을 넘는 계획은 자동 축소 또는 이동</li></ul></aside>
    </section>
  </main>;
}
