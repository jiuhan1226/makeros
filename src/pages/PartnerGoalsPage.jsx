import React, { useMemo, useState } from "react";
import { normalizePartnerState, partnerId } from "../utils/aiPartner";

const dayOptions = [['mon','월'],['tue','화'],['wed','수'],['thu','목'],['fri','금'],['sat','토'],['sun','일']];

function Field({ label, children, hint }) {
  return <label className="partner-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export default function PartnerGoalsPage({ value, onChange, onGeneratePlan, busy = false }) {
  const state = useMemo(() => normalizePartnerState(value), [value]);
  const [saved, setSaved] = useState(false);
  const [certificateDraft, setCertificateDraft] = useState({ name: "", examDate: "" });
  const [goalDraft, setGoalDraft] = useState({ title: "", deadline: "", details: "" });
  const [formMessage, setFormMessage] = useState("");

  function commit(patch) {
    onChange({ ...state, ...patch, schemaVersion: 2, lastUpdatedAt: Date.now() });
    setSaved(true);
    setFormMessage("");
  }

  function patchProfile(patch) {
    commit({ profile: { ...state.profile, ...patch } });
  }

  function setDailyMinutes(nextDaily) {
    const totalMinutes = Object.values(nextDaily).reduce((sum, minutes) => sum + Math.max(0, Number(minutes) || 0), 0);
    patchProfile({ dailyAvailableMinutes: nextDaily, weeklyAvailableHours: Number((totalMinutes / 60).toFixed(1)) });
  }

  function updateDay(key, amount) {
    setDailyMinutes({ ...state.profile.dailyAvailableMinutes, [key]: Math.max(0, Math.min(480, amount)) });
  }

  function applyTimePreset(weekdayMinutes, weekendMinutes) {
    setDailyMinutes(Object.fromEntries(dayOptions.map(([key]) => [key, ['sat', 'sun'].includes(key) ? weekendMinutes : weekdayMinutes])));
  }

  function addFixedSchedule(template = {}) {
    patchProfile({ fixedSchedules: [...state.profile.fixedSchedules, {
      id: partnerId('fixed'),
      title: template.title || '',
      day: template.day || 'mon',
      start: template.start || '18:00',
      end: template.end || '19:00',
      locked: true,
    }] });
  }

  function addCertificate() {
    const name = certificateDraft.name.trim();
    if (!name) {
      setFormMessage("준비할 자격증 이름을 입력해 주세요.");
      return;
    }
    const next = {
      id: partnerId('certificate'),
      name,
      examDate: certificateDraft.examDate,
      status: 'preparing',
      cbtAccuracy: 0,
      weakSubjects: [],
    };
    commit({
      certificateGoals: [...state.certificateGoals, next],
      primaryCertificateGoalId: state.primaryCertificateGoalId || next.id,
      certificateGoal: state.certificateGoal || next,
    });
    setCertificateDraft({ name: "", examDate: "" });
  }

  function updateCertificate(id, patch) {
    const certificateGoals = state.certificateGoals.map((item) => item.id === id ? { ...item, ...patch } : item);
    commit({
      certificateGoals,
      certificateGoal: certificateGoals.find((item) => item.id === state.primaryCertificateGoalId) || certificateGoals[0] || null,
    });
  }

  function removeCertificate(id) {
    const certificateGoals = state.certificateGoals.filter((item) => item.id !== id);
    const primary = certificateGoals.find((item) => item.id === state.primaryCertificateGoalId) || certificateGoals[0] || null;
    commit({ certificateGoals, certificateGoal: primary, primaryCertificateGoalId: primary?.id || "" });
  }

  function addGoal() {
    const title = goalDraft.title.trim();
    if (!title) {
      setFormMessage("AI가 계획할 해야 할 일을 입력해 주세요.");
      return;
    }
    commit({ goals: [...state.goals, {
      id: partnerId('goal'),
      type: 'auto',
      title,
      deadline: goalDraft.deadline,
      details: goalDraft.details,
    }] });
    setGoalDraft({ title: "", deadline: "", details: "" });
  }

  function updateGoal(id, patch) {
    commit({ goals: state.goals.map((item) => item.id === id ? { ...item, ...patch } : item) });
  }

  return <main className="partner-page partner-simple-goals">
    <section className="partner-page-head">
      <div><span className="partner-kicker">SIMPLE SETUP</span><h1>할 일만 알려주세요</h1><p>마감과 가능한 시간만 입력하면 AI가 공부 순서와 하루 분량을 자동으로 나눕니다.</p></div>
      <button className="partner-primary partner-plan-cta" disabled={busy} onClick={onGeneratePlan}>{busy ? "시간에 맞춰 배분 중…" : "AI에게 계획 맡기기"}</button>
    </section>

    {saved && <div className="partner-inline-notice">입력 내용이 저장되었습니다. 계획 만들기를 누르면 AI가 가능한 시간에 맞춰 바로 적용합니다.</div>}
    {formMessage && <div className="partner-form-message" role="alert">{formMessage}</div>}

    <section className="partner-panel partner-simple-section">
      <div className="partner-simple-heading"><span>1</span><div><h2>기본 정보</h2><p>학년과 전공만 알려주세요.</p></div></div>
      <div className="partner-form-grid two">
        <Field label="학년"><select value={state.profile.grade || ""} onChange={(event) => patchProfile({ grade: event.target.value })}><option value="">선택</option><option>1학년</option><option>2학년</option><option>3학년</option></select></Field>
        <Field label="전공"><input value={state.profile.major || ""} onChange={(event) => patchProfile({ major: event.target.value })} placeholder="예: 전기전자과, 스마트팩토리과" /></Field>
      </div>
    </section>

    <section className="partner-panel partner-simple-section">
      <div className="partner-simple-heading"><span>2</span><div><h2>공부할 수 있는 시간</h2><p>평소와 가장 가까운 것 하나만 고르세요.</p></div><strong>{state.profile.weeklyAvailableHours || 0}시간/주</strong></div>
      <div className="partner-simple-presets">
        <button type="button" onClick={() => applyTimePreset(30, 60)}>여유롭게<small>평일 30분 · 주말 1시간</small></button>
        <button type="button" className={(state.profile.weeklyAvailableHours || 0) >= 8 && (state.profile.weeklyAvailableHours || 0) <= 10 ? "active" : ""} onClick={() => applyTimePreset(60, 120)}>보통<small>평일 1시간 · 주말 2시간</small></button>
        <button type="button" onClick={() => applyTimePreset(90, 180)}>집중해서<small>평일 1시간 30분 · 주말 3시간</small></button>
      </div>

      <details className="partner-advanced-settings">
        <summary>요일별 시간이나 고정 일정 직접 조정</summary>
        <div className="partner-day-grid">
          {dayOptions.map(([key,label]) => {
            const minutes = state.profile.dailyAvailableMinutes?.[key] ?? 0;
            return <div className={`partner-day-control ${minutes ? 'active' : ''}`} key={key}>
              <span>{label}</span>
              <div><button type="button" aria-label={`${label}요일 10분 줄이기`} onClick={() => updateDay(key, minutes - 10)}>−</button><strong><b>{minutes}</b><small>분</small></strong><button type="button" aria-label={`${label}요일 10분 늘리기`} onClick={() => updateDay(key, minutes + 10)}>＋</button></div>
              <input aria-label={`${label}요일 학습 가능 시간`} type="range" min="0" max="240" step="10" value={Math.min(240, minutes)} onChange={(event) => updateDay(key, Number(event.target.value))}/>
            </div>;
          })}
        </div>

        <div className="partner-subsection-head">
          <div><strong>AI가 피해야 할 고정 일정</strong><small>수업이나 방과후처럼 공부를 배치하면 안 되는 시간만 등록하세요.</small></div>
          <button className="partner-secondary small" type="button" onClick={() => addFixedSchedule()}>＋ 일정 추가</button>
        </div>
        <div className="partner-fixed-list">
          {state.profile.fixedSchedules.map((item) => <div key={item.id} className="partner-fixed-row">
            <input value={item.title || ''} placeholder="예: 방과후 수업" onChange={(event) => patchProfile({ fixedSchedules: state.profile.fixedSchedules.map((row) => row.id === item.id ? { ...row, title: event.target.value } : row) })}/>
            <select value={item.day || 'mon'} onChange={(event) => patchProfile({ fixedSchedules: state.profile.fixedSchedules.map((row) => row.id === item.id ? { ...row, day: event.target.value } : row) })}>{dayOptions.map(([day,label]) => <option key={day} value={day}>{label}</option>)}</select>
            <input type="time" value={item.start || '18:00'} onChange={(event) => patchProfile({ fixedSchedules: state.profile.fixedSchedules.map((row) => row.id === item.id ? { ...row, start: event.target.value } : row) })}/>
            <input type="time" value={item.end || '19:00'} onChange={(event) => patchProfile({ fixedSchedules: state.profile.fixedSchedules.map((row) => row.id === item.id ? { ...row, end: event.target.value } : row) })}/>
            <button className="partner-text-danger" type="button" onClick={() => patchProfile({ fixedSchedules: state.profile.fixedSchedules.filter((row) => row.id !== item.id) })}>삭제</button>
          </div>)}
        </div>
      </details>
    </section>

    <section className="partner-panel partner-simple-section">
      <div className="partner-simple-heading"><span>3</span><div><h2>준비할 자격증</h2><p>여러 개를 등록하면 시험일과 현재 CBT 기록을 보고 우선순위를 정합니다.</p></div></div>
      <div className="partner-add-row certificate">
        <input value={certificateDraft.name} onChange={(event) => setCertificateDraft({ ...certificateDraft, name: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") addCertificate(); }} placeholder="예: 산업안전산업기사" />
        <input type="date" aria-label="자격증 시험일" value={certificateDraft.examDate} onChange={(event) => setCertificateDraft({ ...certificateDraft, examDate: event.target.value })}/>
        <button type="button" onClick={addCertificate}>추가</button>
      </div>
      <div className="partner-simple-list">
        {state.certificateGoals.map((item) => <article key={item.id}>
          <span className="partner-goal-icon certificate">자격</span>
          <input value={item.name || ""} aria-label="자격증명" onChange={(event) => updateCertificate(item.id, { name: event.target.value })}/>
          <input type="date" aria-label="시험일" value={item.examDate || ""} onChange={(event) => updateCertificate(item.id, { examDate: event.target.value })}/>
          <small>{item.lastCbtAt ? `최근 CBT ${item.cbtAccuracy || 0}점` : "CBT 기록 없음"}</small>
          <button type="button" onClick={() => removeCertificate(item.id)}>삭제</button>
        </article>)}
        {!state.certificateGoals.length && <div className="partner-simple-empty">등록된 자격증이 없습니다. 필요 없으면 비워 두어도 됩니다.</div>}
      </div>
    </section>

    <section className="partner-panel partner-simple-section">
      <div className="partner-simple-heading"><span>4</span><div><h2>그 밖에 해야 할 일</h2><p>내신, 취업 준비, 대회, 프로젝트를 구분하지 말고 문장으로 적으세요. AI가 자동으로 분류합니다.</p></div></div>
      <div className="partner-add-row goal">
        <input value={goalDraft.title} onChange={(event) => setGoalDraft({ ...goalDraft, title: event.target.value })} placeholder="예: 전기기기 내신 80점 만들기" />
        <input type="date" aria-label="목표 마감일" value={goalDraft.deadline} onChange={(event) => setGoalDraft({ ...goalDraft, deadline: event.target.value })}/>
        <textarea value={goalDraft.details} onChange={(event) => setGoalDraft({ ...goalDraft, details: event.target.value })} placeholder="추가로 알려줄 내용이 있다면 자유롭게 입력하세요. 띄어쓰기와 쉼표를 그대로 사용할 수 있어요." />
        <button type="button" onClick={addGoal}>AI에게 맡길 일 추가</button>
      </div>
      <div className="partner-simple-list">
        {state.goals.map((item) => <article className="general" key={item.id}>
          <span className="partner-goal-icon auto">AI</span>
          <div>
            <input value={item.title || ""} aria-label="해야 할 일" onChange={(event) => updateGoal(item.id, { title: event.target.value })}/>
            <textarea value={item.details || ""} aria-label="추가 설명" onChange={(event) => updateGoal(item.id, { details: event.target.value })} placeholder="추가 설명"/>
          </div>
          <input type="date" aria-label="마감일" value={item.deadline || ""} onChange={(event) => updateGoal(item.id, { deadline: event.target.value })}/>
          <button type="button" onClick={() => commit({ goals: state.goals.filter((row) => row.id !== item.id) })}>삭제</button>
        </article>)}
        {!state.goals.length && <div className="partner-simple-empty">아직 맡긴 일이 없습니다. 해야 할 일과 마감만 입력해 보세요.</div>}
      </div>
    </section>

    <section className="partner-submit-bar"><div><strong>입력이 끝났나요?</strong><span>AI가 모든 목표를 가능한 시간 안에 자동으로 나눕니다.</span></div><button className="partner-primary" disabled={busy} onClick={onGeneratePlan}>{busy ? "계획 만드는 중…" : "내 계획 자동으로 만들기"}</button></section>
  </main>;
}
