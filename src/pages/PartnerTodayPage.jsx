import React, { useMemo } from "react";
import { daysUntil, getActivePartnerPlan, getPendingPartnerPlan, normalizePartnerState, planDiff, todayLabel } from "../utils/aiPartner";

function ActionButton({ item, onNavigate, onQuickAction }) {
  const labels = { cbt: "CBT 시작", academic: "내신 학습", career: "진로 준비", activity: "활동 확인", plan: "계획 보기", goals: "목표 입력" };
  const target = item.action === "cbt" ? "past" : item.action === "academic" ? "library" : item.action === "career" ? "career" : item.action === "plan" ? "partnerPlan" : item.action === "goals" ? "partnerGoals" : "projects";
  return <button className="partner-mini-action" onClick={() => onQuickAction ? onQuickAction(item) : onNavigate(target)}>{labels[item.action] || "열기"}</button>;
}

export default function PartnerTodayPage({ state, onNavigate, onQuickAction, onToggleItem, onGeneratePlan, onConfirmPending, busy = false }) {
  const normalized = useMemo(() => normalizePartnerState(state), [state]);
  const active = getActivePartnerPlan(normalized);
  const pending = getPendingPartnerPlan(normalized);
  const diff = pending && active ? planDiff(active, pending) : null;
  const items = active?.today?.items || [];
  const done = items.filter((item) => item.status === "completed").length;
  const goals = [
    ...normalized.academics.map((item) => ({ title: `${item.subject} 시험`, date: item.examDate })),
    normalized.certificateGoal?.name ? { title: `${normalized.certificateGoal.name} 시험`, date: normalized.certificateGoal.examDate } : null,
    ...normalized.activities.map((item) => ({ title: item.title, date: item.deadline })),
  ].filter((item) => item?.date).sort((a,b) => String(a.date).localeCompare(String(b.date))).slice(0,3);

  return <main className="partner-page partner-today-page">
    <section className="partner-today-hero">
      <div>
        <span className="partner-kicker">TODAY · {todayLabel()}</span>
        <h1>{active ? "오늘, 목표에 가장 가까워지는 일부터." : "목표를 입력하면 오늘 할 일까지 연결해 드려요."}</h1>
        <p>{active?.summary || "내신·자격증·취업·대회와 가능한 시간을 함께 보고 12주·이번 주·오늘 계획을 만듭니다."}</p>
        <div className="partner-hero-actions">
          <button className="partner-primary" disabled={busy} onClick={onGeneratePlan}>{busy ? "계획 계산 중…" : active ? "변화 반영해 다시 계산" : "첫 계획 만들기"}</button>
          <button className="partner-secondary" onClick={() => onNavigate("partnerGoals")}>정보 업데이트</button>
        </div>
      </div>
      <div className="partner-today-score">
        <span>오늘 실행</span><strong>{done}/{items.length || 1}</strong><div className="partner-progress-track"><i style={{ width: `${items.length ? done/items.length*100 : 0}%` }}/></div><small>{active ? `${active.today?.availableMinutes || 0}분 안에서 계획됨` : "계획을 먼저 생성해 주세요"}</small>
      </div>
    </section>

    {pending && <section className="partner-replan-banner">
      <div><span>새 재계획안이 준비됐어요</span><strong>{diff?.summary || "변경안을 확인해 주세요"}</strong><p>기존 계획은 아직 유지되고 있습니다. 변경 이유와 차이를 확인한 뒤 적용할 수 있어요.</p></div>
      <div><button className="partner-secondary" onClick={() => onNavigate("partnerPlan")}>차이 보기</button><button className="partner-primary" onClick={onConfirmPending}>새 계획 적용</button></div>
    </section>}

    <section className="partner-two-column">
      <div className="partner-panel">
        <div className="partner-section-title"><div><span>오늘의 행동</span><h2>최대 5개만, 실행 가능한 크기로</h2></div><button className="partner-link" onClick={() => onNavigate("partnerPlan")}>전체 계획</button></div>
        {!items.length && <div className="partner-empty"><strong>아직 확정된 오늘 계획이 없습니다.</strong><p>프로필을 입력하고 첫 계획을 만들어 보세요.</p></div>}
        <div className="partner-task-list">
          {items.map((item, index) => <article key={item.id} className={`partner-task ${item.status === "completed" ? "done" : ""}`}>
            <button className="partner-check" aria-label="완료 상태 변경" onClick={() => onToggleItem(item.id, item.status === "completed" ? "todo" : "completed")}>{item.status === "completed" ? "✓" : index + 1}</button>
            <div><div className="partner-task-title"><strong>{item.title}</strong><span>{item.durationMinutes}분</span></div><p>{item.reason}</p><small>{item.goalType === "academic" ? "내신" : item.goalType === "certificate" ? "자격증" : item.goalType === "career" ? "취업" : item.goalType === "activity" ? "대회·활동" : "설정"}</small></div>
            <ActionButton item={item} onNavigate={onNavigate} onQuickAction={onQuickAction}/>
          </article>)}
        </div>
      </div>

      <aside className="partner-side-stack">
        <section className="partner-panel">
          <div className="partner-section-title compact"><div><span>다가오는 마감</span><h2>놓치면 안 되는 일정</h2></div></div>
          <div className="partner-deadline-list">
            {goals.length ? goals.map((item) => { const d = daysUntil(item.date); return <div key={`${item.title}:${item.date}`}><span><strong>{item.title}</strong><small>{item.date}</small></span><b>{d == null ? "" : d >= 0 ? `D-${d}` : `D+${Math.abs(d)}`}</b></div>; }) : <p className="partner-muted">등록된 마감이 없습니다.</p>}
          </div>
        </section>
      </aside>
    </section>
  </main>;
}
