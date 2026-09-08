import React, { useMemo, useState } from "react";
import { normalizePartnerState, partnerId } from "../utils/aiPartner";

function Field({ label, children, hint }) {
  return <label className="partner-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

const dayOptions = [['mon','월'],['tue','화'],['wed','수'],['thu','목'],['fri','금'],['sat','토'],['sun','일']];

export default function PartnerGoalsPage({ value, onChange, onGeneratePlan, busy = false }) {
  const state = useMemo(() => normalizePartnerState(value), [value]);
  const [saved, setSaved] = useState(false);

  function patchProfile(patch) {
    onChange({ ...state, profile: { ...state.profile, ...patch }, lastUpdatedAt: Date.now() });
    setSaved(true);
  }

  function updateAcademic(id, patch) {
    onChange({ ...state, academics: state.academics.map((item) => item.id === id ? { ...item, ...patch } : item), lastUpdatedAt: Date.now() });
    setSaved(true);
  }

  function updateActivity(id, patch) {
    onChange({ ...state, activities: state.activities.map((item) => item.id === id ? { ...item, ...patch } : item), lastUpdatedAt: Date.now() });
    setSaved(true);
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

  return <main className="partner-page">
    <section className="partner-page-head">
      <div><span className="partner-kicker">MY CONTEXT</span><h1>목표와 현재 상태</h1><p>내신·자격증·취업·활동과 가능한 시간을 업데이트하면 다음 계획에 반영됩니다.</p></div>
      <button className="partner-primary" disabled={busy} onClick={onGeneratePlan}>{busy ? "계획 계산 중…" : "이 정보로 계획 만들기"}</button>
    </section>

    {saved && <div className="partner-inline-notice">변경 내용이 저장되었습니다. 새 계획을 만들기 전까지 현재 확정 계획은 유지됩니다.</div>}

    <section className="partner-panel">
      <div className="partner-section-title"><div><span>기본 정보</span><h2>내가 실제로 사용할 수 있는 시간을 먼저 고정해요</h2></div></div>
      <div className="partner-form-grid three">
        <Field label="학년"><select value={state.profile.grade || ""} onChange={(e) => patchProfile({ grade: e.target.value })}><option value="">선택</option><option>1학년</option><option>2학년</option><option>3학년</option></select></Field>
        <Field label="전공"><input value={state.profile.major || ""} onChange={(e) => patchProfile({ major: e.target.value })} placeholder="예: 전기전자과" /></Field>
        <div className="partner-weekly-total"><span>주간 학습 가능 시간</span><strong>{state.profile.weeklyAvailableHours || 0}시간</strong><small>아래 요일별 시간을 합산해 자동 계산</small></div>
      </div>
      <div className="partner-time-presets" aria-label="학습 가능 시간 빠른 설정">
        <span>빠른 설정</span>
        <button type="button" onClick={() => applyTimePreset(30, 60)}>가볍게 · 주 4.5시간</button>
        <button type="button" onClick={() => applyTimePreset(60, 120)}>기본 · 주 9시간</button>
        <button type="button" onClick={() => applyTimePreset(90, 180)}>집중 · 주 13.5시간</button>
      </div>
      <div className="partner-day-grid">
        {dayOptions.map(([key,label]) => {
          const minutes = state.profile.dailyAvailableMinutes?.[key] ?? 0;
          return <div className={`partner-day-control ${minutes ? 'active' : ''}`} key={key}>
            <span>{label}</span>
            <div><button type="button" aria-label={`${label}요일 10분 줄이기`} onClick={() => updateDay(key, minutes - 10)}>−</button><strong>{minutes}<small>분</small></strong><button type="button" aria-label={`${label}요일 10분 늘리기`} onClick={() => updateDay(key, minutes + 10)}>＋</button></div>
            <input aria-label={`${label}요일 학습 가능 시간`} type="range" min="0" max="240" step="10" value={Math.min(240, minutes)} onChange={(e) => updateDay(key, Number(e.target.value))}/>
          </div>;
        })}
      </div>
      <div className="partner-subsection-head">
        <div><strong>고정 일정</strong><small>수업·방과후·기숙사 일정처럼 AI가 옮기면 안 되는 시간을 등록합니다.</small></div>
        <button className="partner-secondary small" onClick={() => addFixedSchedule()}>＋ 직접 추가</button>
      </div>
      <div className="partner-schedule-presets">
        <span>자주 쓰는 일정</span>
        <button type="button" onClick={() => addFixedSchedule({ title: '방과후 수업', start: '16:30', end: '18:00' })}>＋ 방과후 수업</button>
        <button type="button" onClick={() => addFixedSchedule({ title: '기숙사 자습', start: '19:30', end: '21:00' })}>＋ 기숙사 자습</button>
      </div>
      <div className="partner-fixed-list">
        {state.profile.fixedSchedules.map((item) => <div key={item.id} className="partner-fixed-row">
          <input value={item.title || ''} placeholder="예: 방과후 수업" onChange={(e) => patchProfile({ fixedSchedules: state.profile.fixedSchedules.map((x) => x.id === item.id ? { ...x, title: e.target.value } : x) })}/>
          <select value={item.day || 'mon'} onChange={(e) => patchProfile({ fixedSchedules: state.profile.fixedSchedules.map((x) => x.id === item.id ? { ...x, day: e.target.value } : x) })}>{dayOptions.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select>
          <input type="time" value={item.start || '18:00'} onChange={(e) => patchProfile({ fixedSchedules: state.profile.fixedSchedules.map((x) => x.id === item.id ? { ...x, start: e.target.value } : x) })}/>
          <input type="time" value={item.end || '19:00'} onChange={(e) => patchProfile({ fixedSchedules: state.profile.fixedSchedules.map((x) => x.id === item.id ? { ...x, end: e.target.value } : x) })}/>
          <div className="partner-fixed-actions"><button type="button" className="partner-copy-button" onClick={() => addFixedSchedule({ ...item, day: dayOptions[(dayOptions.findIndex(([key]) => key === item.day) + 1) % 7][0] })}>다음 날 복사</button><button className="partner-text-danger" onClick={() => patchProfile({ fixedSchedules: state.profile.fixedSchedules.filter((x) => x.id !== item.id) })}>삭제</button></div>
        </div>)}
      </div>
    </section>

    <section className="partner-panel">
      <div className="partner-section-title"><div><span>내신</span><h2>시험일까지 어떤 과목을 얼마나 끌어올릴지</h2></div><button className="partner-secondary" onClick={() => onChange({ ...state, academics: [...state.academics, { id: partnerId('academic'), subject: '', currentScore: '', targetScore: '', examDate: '', weakUnits: [] }] })}>과목 추가</button></div>
      {!state.academics.length && <div className="partner-empty compact">아직 등록된 내신 과목이 없습니다.</div>}
      <div className="partner-stack">
        {state.academics.map((item) => <article className="partner-edit-card" key={item.id}>
          <div className="partner-form-grid four">
            <Field label="과목"><input value={item.subject || ""} onChange={(e) => updateAcademic(item.id, { subject: e.target.value })} placeholder="예: 전기기기"/></Field>
            <Field label="현재 점수"><input type="number" min="0" max="100" value={item.currentScore ?? ""} onChange={(e) => updateAcademic(item.id, { currentScore: e.target.value })}/></Field>
            <Field label="목표 점수"><input type="number" min="0" max="100" value={item.targetScore ?? ""} onChange={(e) => updateAcademic(item.id, { targetScore: e.target.value })}/></Field>
            <Field label="시험일"><input type="date" value={item.examDate || ""} onChange={(e) => updateAcademic(item.id, { examDate: e.target.value })}/></Field>
          </div>
          <Field label="취약 단원" hint="쉼표로 구분"><input value={(item.weakUnits || []).join(', ')} onChange={(e) => updateAcademic(item.id, { weakUnits: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })} placeholder="예: 변압기, 유도전동기"/></Field>
          <button className="partner-text-danger" onClick={() => onChange({ ...state, academics: state.academics.filter((x) => x.id !== item.id) })}>과목 삭제</button>
        </article>)}
      </div>
    </section>

    <section className="partner-panel">
      <div className="partner-section-title"><div><span>자격증</span><h2>목표 종목과 CBT 결과를 같은 계획에 연결해요</h2></div></div>
      <div className="partner-form-grid four">
        <Field label="목표 자격증"><input value={state.certificateGoal?.name || ""} onChange={(e) => onChange({ ...state, certificateGoal: { ...(state.certificateGoal || { id: partnerId('certificate') }), name: e.target.value } })} placeholder="예: 산업안전산업기사"/></Field>
        <Field label="상태"><select value={state.certificateGoal?.status || "preparing"} onChange={(e) => onChange({ ...state, certificateGoal: { ...(state.certificateGoal || { id: partnerId('certificate') }), status: e.target.value } })}><option value="preparing">준비 중</option><option value="registered">접수 완료</option><option value="passed">취득 완료</option><option value="failed">재도전</option></select></Field>
        <Field label="시험일"><input type="date" value={state.certificateGoal?.examDate || ""} onChange={(e) => onChange({ ...state, certificateGoal: { ...(state.certificateGoal || { id: partnerId('certificate') }), examDate: e.target.value } })}/></Field>
        <Field label="최근 CBT 정답률"><input type="number" min="0" max="100" value={state.certificateGoal?.cbtAccuracy ?? ""} onChange={(e) => onChange({ ...state, certificateGoal: { ...(state.certificateGoal || { id: partnerId('certificate') }), cbtAccuracy: Number(e.target.value) || 0 } })}/></Field>
      </div>
    </section>

    <section className="partner-panel">
      <div className="partner-section-title"><div><span>취업 목표</span><h2>장기 목표에서 지금 준비할 역량을 역산해요</h2></div></div>
      <div className="partner-form-grid four">
        <Field label="산업"><input value={state.careerGoal.industry || ""} onChange={(e) => onChange({ ...state, careerGoal: { ...state.careerGoal, industry: e.target.value } })} placeholder="예: 건설·플랜트"/></Field>
        <Field label="희망 기업"><input value={state.careerGoal.company || ""} onChange={(e) => onChange({ ...state, careerGoal: { ...state.careerGoal, company: e.target.value } })} placeholder="예: 삼성물산"/></Field>
        <Field label="희망 직무"><input value={state.careerGoal.role || ""} onChange={(e) => onChange({ ...state, careerGoal: { ...state.careerGoal, role: e.target.value } })} placeholder="예: 전기직"/></Field>
        <Field label="지원 목표 시기"><input type="date" value={state.careerGoal.targetDate || ""} onChange={(e) => onChange({ ...state, careerGoal: { ...state.careerGoal, targetDate: e.target.value } })}/></Field>
      </div>
      <Field label="필요하다고 생각하는 역량·준비" hint="쉼표로 구분"><input value={(state.careerGoal.skills || []).join(', ')} onChange={(e) => onChange({ ...state, careerGoal: { ...state.careerGoal, skills: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) } })} placeholder="예: 전기설비, 산업안전, 현장 커뮤니케이션"/></Field>
    </section>

    <section className="partner-panel">
      <div className="partner-section-title"><div><span>교내외 활동</span><h2>대회·프로젝트 마감도 같은 시간축에서 관리해요</h2></div><button className="partner-secondary" disabled={state.activities.length >= 2} onClick={() => onChange({ ...state, activities: [...state.activities, { id: partnerId('activity'), type: 'competition', title: '', deadline: '', stage: 'preparing', role: '' }].slice(0, 2) })}>활동 추가</button></div>
      {!state.activities.length && <div className="partner-empty compact">MVP에서는 활동을 최대 2개까지 등록할 수 있습니다.</div>}
      <div className="partner-stack">
        {state.activities.map((item) => <article className="partner-edit-card" key={item.id}>
          <div className="partner-form-grid four">
            <Field label="활동명"><input value={item.title || ""} onChange={(e) => updateActivity(item.id, { title: e.target.value })} placeholder="예: AI Competition"/></Field>
            <Field label="종류"><select value={item.type || "competition"} onChange={(e) => updateActivity(item.id, { type: e.target.value })}><option value="competition">대회</option><option value="project">프로젝트</option><option value="school">교내 활동</option></select></Field>
            <Field label="마감"><input type="date" value={item.deadline || ""} onChange={(e) => updateActivity(item.id, { deadline: e.target.value })}/></Field>
            <Field label="현재 단계"><select value={item.stage || "preparing"} onChange={(e) => updateActivity(item.id, { stage: e.target.value })}><option value="preparing">준비</option><option value="submitted">제출</option><option value="final">본선·최종</option><option value="completed">완료</option></select></Field>
          </div>
          <button className="partner-text-danger" onClick={() => onChange({ ...state, activities: state.activities.filter((x) => x.id !== item.id) })}>활동 삭제</button>
        </article>)}
      </div>
    </section>
  </main>;
}
