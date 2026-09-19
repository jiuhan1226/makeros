import React, { useMemo } from "react";
import { daysUntil, getActivePartnerPlan, getPendingPartnerPlan, normalizePartnerState, planDiff, todayLabel } from "../utils/aiPartner";

function ActionButton({ item, onNavigate, onQuickAction, learningAction }) {
  const labels = { cbt: "CBT 시작", academic: "내신 학습", career: "진로 준비", activity: "활동 확인", plan: "계획 보기", goals: "목표 입력" };
  const target = item.action === "cbt" ? "past" : item.action === "academic" ? "library" : item.action === "career" ? "career" : item.action === "plan" ? "partnerPlan" : item.action === "goals" ? "partnerGoals" : "projects";
  const working = item.action === "cbt" && ["analyzing", "generating"].includes(learningAction?.status);
  const current = working && learningAction?.itemId === item.id;
  const label = current ? (learningAction.status === "analyzing" ? "분석 중…" : "문제 생성 중…") : labels[item.action] || "열기";
  return <button className="partner-mini-action" disabled={working} onClick={() => onQuickAction ? onQuickAction(item) : onNavigate(target)}>{label}</button>;
}

function TodayTask({ item, index, onNavigate, onQuickAction, onOpenPlanItem, learningAction, onToggleItem, onAdjustItem }) {
  return <article className={`partner-task ${item.status === "completed" ? "done" : ""}`}>
    <button className="partner-check" aria-label="완료 상태 변경" onClick={() => onToggleItem(item.id, item.status === "completed" ? "todo" : "completed")}>{item.status === "completed" ? "✓" : index + 1}</button>
    <div className="partner-task-content"><button type="button" className="partner-task-open" onClick={() => onOpenPlanItem?.(item.goalId)}><div className="partner-task-title"><strong>{item.title}</strong><span>{item.durationMinutes}분</span></div><small>{item.goalType === "academic" ? "내신" : item.goalType === "certificate" ? "자격증" : item.goalType === "career" ? "취업" : item.goalType === "activity" ? "대회·활동" : "일정"}</small></button>{item.reason && <details className="partner-task-reason"><summary>왜 이 일부터?</summary><p>{item.reason}</p></details>}</div>
    <div className="partner-task-actions">
      <ActionButton item={item} onNavigate={onNavigate} onQuickAction={onQuickAction} learningAction={learningAction}/>
      {item.status !== "completed" && <details><summary>조정</summary><div><button type="button" onClick={() => onAdjustItem?.(item.id, "reduce")}>15분 줄이기</button><button type="button" onClick={() => onAdjustItem?.(item.id, "defer")}>내일로 이동</button><button type="button" onClick={() => onAdjustItem?.(item.id, "skip")}>오늘은 건너뛰기</button></div></details>}
    </div>
  </article>;
}

export default function PartnerTodayPage({ state, activeSession = null, onResumeSession, onNavigate, onQuickAction, onOpenPlanItem, learningAction, onToggleItem, onAdjustItem, onToggleDayOff, onGeneratePlan, onConfirmPending, busy = false }) {
  const normalized = useMemo(() => normalizePartnerState(state), [state]);
  const active = getActivePartnerPlan(normalized);
  const pending = getPendingPartnerPlan(normalized);
  const diff = pending && active ? planDiff(active, pending) : null;
  const pendingReason = pending?.basedOnEventId
    ? normalized.changeEvents.find((event) => event.id === pending.basedOnEventId)?.label
    : "";
  const items = active?.today?.items || [];
  const focusItems = items.slice(0, 2);
  const extraItems = items.slice(2);
  const done = items.filter((item) => item.status === "completed").length;
  const nextItem = items.find((item) => item.status !== "completed");
  const capacity = active?.today?.capacityBreakdown || {
    baseMinutes: active?.today?.availableMinutes || 0,
    fixedMinutes: 0,
    availableMinutes: active?.today?.availableMinutes || 0,
    dayOff: Boolean(active?.today?.isDayOff),
  };
  const isDayOff = Boolean(active?.today?.isDayOff || capacity.dayOff);
  const goals = [
    ...normalized.goals.map((item) => ({ id: item.id, title: item.title, date: item.deadline })),
    ...normalized.certificateGoals.map((item) => ({ id: item.id, title: `${item.name} 시험`, date: item.examDate })),
  ].filter((item) => item?.date).sort((a,b) => String(a.date).localeCompare(String(b.date))).slice(0,3);
  const lastDiagnostic = normalized.certificateGoals
    .map((item) => item.lastDiagnostic ? { ...item.lastDiagnostic, certificateName: item.name } : null)
    .filter(Boolean)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];

  return <main className="partner-page partner-today-page">
    <section className="partner-today-hero">
      <div>
        <span className="partner-kicker">TODAY · {todayLabel()}</span>
        <h1>{active ? "오늘, 목표에 가장 가까워지는 일부터." : "목표를 입력하면 오늘 할 일까지 연결해 드려요."}</h1>
        <p>{active?.summary || "목표일과 가능한 시간을 입력하면 마감일부터 역산해 이번 주와 오늘 계획을 만듭니다."}</p>
        <div className="partner-hero-actions">
          {!active && <button className="partner-primary" disabled={busy} onClick={onGeneratePlan}>{busy ? "계획 계산 중…" : "첫 계획 만들기"}</button>}
          {active && nextItem && !isDayOff && <button className="partner-primary" onClick={() => onQuickAction?.(nextItem)}>오늘 할 일 시작</button>}
          {activeSession && <button className={active && nextItem ? "partner-secondary" : "partner-primary"} onClick={onResumeSession}>이전 학습 이어하기 · {activeSession.answered}/{activeSession.total}</button>}
          {active && !nextItem && !activeSession && <button className="partner-primary" onClick={() => onNavigate("partnerPlan")}>전체 계획 보기</button>}
          {active && <button className="partner-text-action" disabled={busy} onClick={onGeneratePlan}>{busy ? "계산 중…" : "계획 다시 계산"}</button>}
        </div>
      </div>
      <div className="partner-today-score">
        <span>오늘 실행</span><strong>{done}/{items.length}</strong><div className="partner-progress-track"><i style={{ width: `${items.length ? done/items.length*100 : 0}%` }}/></div><small>{isDayOff ? "오늘은 휴식일입니다" : active ? `${active.today?.availableMinutes || 0}분 안에서 계획됨` : "계획을 먼저 생성해 주세요"}</small>
      </div>
    </section>

    {active && <section className="partner-capacity-ledger" aria-label="오늘 계획 계산 근거">
      <div><span>기본 가능 시간</span><strong>{capacity.baseMinutes}분</strong></div>
      <i aria-hidden="true">−</i>
      <div><span>고정 일정</span><strong>{capacity.fixedMinutes}분</strong></div>
      <i aria-hidden="true">=</i>
      <div><span>실제 배치 시간</span><strong>{capacity.availableMinutes}분</strong></div>
      <button type="button" className={isDayOff ? "active" : ""} onClick={() => onToggleDayOff?.(!isDayOff)}>{isDayOff ? "휴식 해제" : "오늘은 휴식"}</button>
    </section>}

    {pending && <section className="partner-replan-banner">
      <div><span>새 재계획안이 준비됐어요</span><strong>{diff?.summary || "변경안을 확인해 주세요"}</strong><p>{pendingReason || "최근 목표·학습 결과를 반영했습니다."} 기존 계획은 확인 전까지 유지됩니다.</p></div>
      <div><button className="partner-secondary" onClick={() => onNavigate("partnerPlan")}>차이 보기</button><button className="partner-primary" onClick={onConfirmPending}>새 계획 적용</button></div>
    </section>}

    {["analyzing", "generating", "error"].includes(learningAction?.status) && <section className={`partner-learning-action ${learningAction.status}`} role={learningAction.status === "error" ? "alert" : "status"}>
      <span>{learningAction.status === "error" ? "!" : <i />}</span>
      <div><strong>{learningAction.status === "analyzing" ? "현재 기출 풀이 수준 확인 중" : learningAction.status === "generating" ? "맞춤 테스트 문제 생성 중" : "맞춤 학습을 시작하지 못했어요"}</strong><p>{learningAction.message}</p></div>
      {learningAction.status === "error" && <button type="button" onClick={() => onNavigate(learningAction.actionPage || "partnerGoals")}>{learningAction.actionLabel || "목표 확인"}</button>}
    </section>}

    <section className="partner-two-column">
      <div className="partner-panel">
        <div className="partner-section-title"><div><span>오늘의 핵심 행동</span><h2>먼저 할 일 {Math.min(2, items.length)}개</h2></div><button className="partner-link" onClick={() => onNavigate("partnerPlan")}>전체 계획</button></div>
        {!items.length && <div className="partner-empty"><strong>{isDayOff ? "오늘은 휴식일로 설정했습니다." : "아직 확정된 오늘 계획이 없습니다."}</strong><p>{isDayOff ? "휴식을 해제하면 남은 목표와 가능한 시간을 기준으로 오늘 계획을 다시 만듭니다." : "프로필을 입력하고 첫 계획을 만들어 보세요."}</p></div>}
        <div className="partner-task-list">
          {focusItems.map((item, index) => <TodayTask key={item.id} item={item} index={index} onNavigate={onNavigate} onQuickAction={onQuickAction} onOpenPlanItem={onOpenPlanItem} learningAction={learningAction} onToggleItem={onToggleItem} onAdjustItem={onAdjustItem}/>)}
          {!!extraItems.length && <details className="partner-extra-tasks"><summary>그다음 할 일 {extraItems.length}개</summary><div>{extraItems.map((item, index) => <TodayTask key={item.id} item={item} index={index + 2} onNavigate={onNavigate} onQuickAction={onQuickAction} onOpenPlanItem={onOpenPlanItem} learningAction={learningAction} onToggleItem={onToggleItem} onAdjustItem={onAdjustItem}/>)}</div></details>}
        </div>
      </div>

      <aside className="partner-side-stack">
        <section className="partner-panel">
          <div className="partner-section-title compact"><div><span>다가오는 마감</span><h2>놓치면 안 되는 일정</h2></div></div>
          <div className="partner-deadline-list">
            {goals.length ? goals.map((item) => { const d = daysUntil(item.date); return <button type="button" key={`${item.title}:${item.date}`} onClick={() => onOpenPlanItem?.(item.id)}><span><strong>{item.title}</strong><small>{item.date}</small></span><b>{d == null ? "" : d >= 0 ? `D-${d}` : `D+${Math.abs(d)}`}</b></button>; }) : <p className="partner-muted">등록된 마감이 없습니다.</p>}
          </div>
        </section>
        {lastDiagnostic && <section className="partner-panel partner-last-diagnostic">
          <span>최근 맞춤 진단</span>
          <h3>{lastDiagnostic.certificateName}</h3>
          <div><strong>{lastDiagnostic.score}<small>점</small></strong><p>{lastDiagnostic.correct}/{lastDiagnostic.total}문제 정답</p></div>
          <ul>{(lastDiagnostic.weakSubjects || []).map((subject) => <li key={subject}>{subject}</li>)}</ul>
          <button className="partner-secondary full" onClick={() => onNavigate("report")}>상세 학습 결과</button>
        </section>}
      </aside>
    </section>
  </main>;
}
