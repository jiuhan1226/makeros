const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABELS = { sun: "일", mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토" };

export function partnerId(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isoDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function dateAtNoon(value) {
  const raw = isoDate(value);
  return raw ? new Date(`${raw}T12:00:00`) : null;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function daysUntil(value, base = new Date()) {
  const target = dateAtNoon(value);
  if (!target) return null;
  const start = dateAtNoon(base) || base;
  return Math.ceil((target.getTime() - start.getTime()) / 86400000);
}

export function createDefaultPartnerState() {
  return {
    schemaVersion: 2,
    profile: {
      grade: "",
      major: "",
      weeklyAvailableHours: 13.5,
      dailyAvailableMinutes: { mon: 90, tue: 90, wed: 90, thu: 90, fri: 90, sat: 180, sun: 180 },
      fixedSchedules: [],
      sleepProtected: true,
    },
    academics: [],
    certificateGoal: null,
    certificateGoals: [],
    careerGoal: { industry: "", company: "", role: "", targetDate: "", skills: [] },
    activities: [],
    goals: [],
    calendarExtras: [],
    planVersions: [],
    activePlanVersionId: "",
    pendingPlanVersionId: "",
    changeEvents: [],
    studyLinks: [],
    lastUpdatedAt: Date.now(),
  };
}

export function normalizePartnerState(input = {}) {
  const base = createDefaultPartnerState();
  const state = { ...base, ...(input || {}) };
  state.profile = { ...base.profile, ...(input?.profile || {}) };
  state.profile.dailyAvailableMinutes = {
    ...base.profile.dailyAvailableMinutes,
    ...(input?.profile?.dailyAvailableMinutes || {}),
  };
  state.profile.fixedSchedules = Array.isArray(input?.profile?.fixedSchedules) ? input.profile.fixedSchedules : [];
  state.academics = Array.isArray(input?.academics) ? input.academics : [];
  state.activities = Array.isArray(input?.activities) ? input.activities : [];
  state.calendarExtras = Array.isArray(input?.calendarExtras) ? input.calendarExtras : [];
  state.planVersions = Array.isArray(input?.planVersions) ? input.planVersions : [];
  state.changeEvents = Array.isArray(input?.changeEvents) ? input.changeEvents : [];
  state.studyLinks = Array.isArray(input?.studyLinks) ? input.studyLinks : [];
  state.careerGoal = { ...base.careerGoal, ...(input?.careerGoal || {}) };
  state.certificateGoals = Array.isArray(input?.certificateGoals)
    ? input.certificateGoals
    : input?.certificateGoal?.name
      ? [input.certificateGoal]
      : [];
  const primaryCertificateId = String(input?.primaryCertificateGoalId || input?.certificateGoal?.id || "");
  state.certificateGoal = state.certificateGoals.find((item) => String(item.id) === primaryCertificateId) || state.certificateGoals[0] || null;
  state.primaryCertificateGoalId = state.certificateGoal?.id || "";
  state.goals = Array.isArray(input?.goals) ? input.goals : [
    ...state.academics.filter((item) => item?.subject).map((item) => ({
      id: item.id || partnerId("goal"),
      type: "academic",
      title: `${item.subject} 내신 준비`,
      deadline: item.examDate || "",
      details: [item.targetScore ? `목표 ${item.targetScore}점` : "", ...(item.weakUnits || [])].filter(Boolean).join(", "),
    })),
    ...(state.careerGoal?.company || state.careerGoal?.role ? [{
      id: "career:primary",
      type: "career",
      title: `${state.careerGoal.company || ""} ${state.careerGoal.role || "취업 준비"}`.trim(),
      deadline: state.careerGoal.targetDate || "",
      details: (state.careerGoal.skills || []).join(", "),
    }] : []),
    ...state.activities.filter((item) => item?.title).map((item) => ({
      id: item.id || partnerId("goal"),
      type: "activity",
      title: item.title,
      deadline: item.deadline || "",
      details: item.role || "",
    })),
  ];
  return state;
}

export function profileSnapshot(state) {
  const normalized = normalizePartnerState(state);
  return {
    capturedAt: Date.now(),
    profile: normalized.profile,
    academics: normalized.academics,
    certificateGoal: normalized.certificateGoal,
    certificateGoals: normalized.certificateGoals,
    careerGoal: normalized.careerGoal,
    activities: normalized.activities,
    goals: normalized.goals,
    calendarExtras: normalized.calendarExtras,
  };
}

function goalPriority(goal, today = new Date()) {
  const dday = daysUntil(goal.deadline, today);
  const urgency = dday == null ? 0.35 : dday <= 3 ? 1 : dday <= 7 ? 0.9 : dday <= 21 ? 0.72 : dday <= 60 ? 0.55 : 0.42;
  return Math.min(1, Math.max(0.1, urgency * 0.65 + Number(goal.importance || 0.7) * 0.35));
}

function academicGoal(item) {
  const current = Number(item.currentScore || 0);
  const target = Number(item.targetScore || 0);
  const gap = Math.max(0, target - current);
  return {
    goalId: item.id || `academic:${item.subject}`,
    type: "academic",
    title: `${item.subject || "내신 과목"} 목표`,
    deadline: item.examDate || "",
    importance: Math.min(1, 0.65 + Math.min(30, gap) / 100),
    meta: { subject: item.subject || "내신", gap, weakUnits: item.weakUnits || [] },
  };
}

function certificateGoal(item) {
  if (!item?.name) return null;
  const accuracy = Number(item.cbtAccuracy || 0);
  return {
    goalId: item.id || `certificate:${item.name}`,
    type: "certificate",
    title: `${item.name} 준비`,
    deadline: item.examDate || "",
    importance: Math.min(1, 0.72 + Math.max(0, 70 - accuracy) / 200),
    meta: { name: item.name, status: item.status || "preparing", accuracy, weakSubjects: item.weakSubjects || [] },
  };
}

function careerGoal(item) {
  if (!item?.role && !item?.company) return null;
  return {
    goalId: "career:primary",
    type: "career",
    title: `${item.company || item.industry || "희망 분야"} ${item.role || "취업"}`.trim(),
    deadline: item.targetDate || "",
    importance: 0.86,
    meta: { ...item },
  };
}

function activityGoal(item, index) {
  if (!item?.title) return null;
  return {
    goalId: item.id || `activity:${index}`,
    type: "activity",
    title: item.title,
    deadline: item.deadline || "",
    importance: item.stage === "final" ? 0.9 : 0.74,
    meta: { ...item },
  };
}

function inferGoalType(item = {}) {
  if (["academic", "career", "activity", "custom"].includes(item.type)) return item.type;
  const text = `${item.title || ""} ${item.details || ""}`;
  if (/내신|과목|중간고사|기말고사|수행평가/.test(text)) return "academic";
  if (/취업|입사|지원|면접|자소서|기업|직무/.test(text)) return "career";
  if (/대회|공모전|프로젝트|해커톤|발표|제출|포트폴리오/.test(text)) return "activity";
  return "custom";
}

function simpleGoal(item, index) {
  if (!item?.title) return null;
  const type = inferGoalType(item);
  return {
    goalId: item.id || `goal:${index}`,
    type,
    title: item.title,
    deadline: item.deadline || "",
    importance: 0.76,
    meta: { ...item, details: item.details || "" },
  };
}

export function collectGoals(state) {
  const normalized = normalizePartnerState(state);
  return [
    ...normalized.goals.map(simpleGoal),
    ...normalized.certificateGoals.map(certificateGoal),
  ].filter(Boolean);
}

function milestoneTemplates(goal) {
  if (goal.type === "academic") {
    const unit = goal.meta.weakUnits?.[0];
    return [
      ["시험 범위와 목표 정리", 45, "범위와 현재 수준을 먼저 고정해 이후 공부량을 안정적으로 나눕니다."],
      [unit ? `${unit} 취약 개념 보완` : "취약 단원 개념 보완", 75, "점수 차이를 줄이기 위해 취약 개념을 먼저 보완합니다."],
      ["확인 문제 풀이와 자기평가", 60, "개념 학습 결과를 확인 문제와 자기평가로 검증합니다."],
      ["오답 재학습", 60, "틀린 이유를 다시 확인해 같은 실수를 줄입니다."],
      ["시험 직전 핵심 정리", 45, "시험 직전에는 새로운 범위보다 핵심 개념과 오답을 우선합니다."],
    ];
  }
  if (goal.type === "certificate") {
    const weak = goal.meta.weakSubjects?.[0];
    return [
      ["기출 범위 진단", 50, "현재 기출 풀이 수준을 확인해 남은 기간의 분량을 조정합니다."],
      [weak ? `${weak} 취약 파트 복습` : "취약 과목 복습", 70, "최근 CBT 결과의 취약 영역을 우선 보완합니다."],
      ["CBT 기출 1회분 학습", 70, "실제 기출 흐름을 반복해 문제 유형과 시간 감각을 익힙니다."],
      ["반복 오답 집중 복습", 55, "반복해서 틀리는 문제를 먼저 해결해 점수 변동을 줄입니다."],
      ["실전 모의 점검", 70, "시험 전 실제 시간과 문항 구성에 맞춰 최종 상태를 확인합니다."],
    ];
  }
  if (goal.type === "career") {
    return [
      ["희망 직무 준비 항목 정리", 40, "장기 목표를 지금 준비할 수 있는 역량과 경험으로 나눕니다."],
      ["필요 역량과 현재 경험 비교", 50, "부족한 역량을 확인해 내신·자격·프로젝트와 연결합니다."],
      ["포트폴리오 근거 정리", 60, "프로젝트와 학습 기록을 직무 역량의 근거로 정리합니다."],
      ["지원 문서 초안 보완", 60, "지원 시기에 맞춰 자기소개와 경험 근거를 미리 준비합니다."],
    ];
  }
  return [
    ["요구사항과 마감 확인", 40, "대회·프로젝트 마감과 평가 기준을 먼저 확인합니다."],
    ["이번 주 핵심 산출물 제작", 90, "마감에 가장 직접적인 결과물을 먼저 완성합니다."],
    ["팀 진행 상황 점검", 35, "역할과 남은 일을 확인해 지연 가능성을 줄입니다."],
    ["제출 전 검토", 60, "제출 직전에는 새 기능보다 누락과 품질 검토를 우선합니다."],
  ];
}

function weekStart(base, weekIndex) {
  const date = new Date(base);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset + weekIndex * 7);
  return isoDate(date);
}

function weekEnd(base, weekIndex) {
  return isoDate(addDays(dateAtNoon(weekStart(base, weekIndex)), 6));
}

function weeklyAvailableMinutes(state) {
  const profile = normalizePartnerState(state).profile;
  const daily = profile.dailyAvailableMinutes || {};
  const sum = Object.values(daily).reduce((total, value) => total + Math.max(0, Number(value) || 0), 0);
  const fromHours = Math.max(0, Number(profile.weeklyAvailableHours || 0) * 60);
  return Math.max(60, Math.min(sum || fromHours || 480, fromHours || sum || 480));
}

function todayAvailableMinutes(state, today = new Date()) {
  const profile = normalizePartnerState(state).profile;
  const key = DAY_KEYS[today.getDay()];
  return Math.max(20, Number(profile.dailyAvailableMinutes?.[key] || Math.round(weeklyAvailableMinutes(state) / 7)));
}

function targetWeek(goal, stepIndex, stepCount, today) {
  const dday = daysUntil(goal.deadline, today);
  const horizonWeeks = dday == null ? 12 : Math.max(1, Math.min(12, Math.ceil(Math.max(1, dday) / 7)));
  const ratio = stepCount <= 1 ? 0 : stepIndex / (stepCount - 1);
  return Math.max(0, Math.min(11, Math.floor(ratio * Math.max(0, horizonWeeks - 1))));
}

export function buildDeterministicPlan(state, options = {}) {
  const normalized = normalizePartnerState(state);
  const today = dateAtNoon(options.today || new Date()) || new Date();
  const goals = collectGoals(normalized)
    .map((goal) => ({ ...goal, priority: goalPriority(goal, today) }))
    .sort((a, b) => b.priority - a.priority);
  const weeks = Array.from({ length: 12 }, (_, index) => ({
    weekIndex: index,
    startsAt: weekStart(today, index),
    endsAt: weekEnd(today, index),
    items: [],
    totalMinutes: 0,
  }));
  const roadmap = [];

  for (const goal of goals) {
    const templates = milestoneTemplates(goal);
    const milestones = templates.map(([title, duration, reason], index) => {
      const weekIndex = targetWeek(goal, index, templates.length, today);
      const deadline = goal.deadline || weeks[weekIndex].endsAt;
      const item = {
        id: partnerId("plan"),
        goalId: goal.goalId,
        goalType: goal.type,
        title,
        reason,
        dueAt: deadline,
        durationMinutes: duration,
        priority: Number((goal.priority * (1 - index * 0.04)).toFixed(2)),
        status: "todo",
        source: "rules",
        action: goal.type === "certificate" ? "cbt" : goal.type === "academic" ? "academic" : goal.type === "career" ? "career" : "activity",
      };
      weeks[weekIndex].items.push(item);
      weeks[weekIndex].totalMinutes += duration;
      return { ...item, weekIndex };
    });
    roadmap.push({
      goalId: goal.goalId,
      type: goal.type,
      title: goal.title,
      deadline: goal.deadline,
      priority: goal.priority,
      milestones,
    });
  }

  const weekLimit = weeklyAvailableMinutes(normalized);
  for (const week of weeks) {
    week.items.sort((a, b) => b.priority - a.priority || String(a.dueAt).localeCompare(String(b.dueAt)));
    if (week.totalMinutes > weekLimit && week.items.length) {
      const ratio = weekLimit / week.totalMinutes;
      week.items = week.items.map((item) => ({
        ...item,
        durationMinutes: Math.max(20, Math.round((item.durationMinutes * ratio) / 5) * 5),
        reason: `${item.reason} 이번 주 가능 시간을 넘지 않도록 분량을 조정했습니다.`,
      }));
      week.totalMinutes = week.items.reduce((sum, item) => sum + item.durationMinutes, 0);
    }
  }

  const thisWeek = weeks[0];
  const todayLimit = todayAvailableMinutes(normalized, today);
  let remaining = todayLimit;
  const todayItems = [];
  for (const item of thisWeek.items) {
    if (todayItems.length >= 5 || remaining < 20) break;
    const duration = Math.min(item.durationMinutes, remaining, 75);
    if (duration < 20) continue;
    todayItems.push({ ...item, id: partnerId("today"), parentPlanItemId: item.id, durationMinutes: duration });
    remaining -= duration;
  }
  if (!todayItems.length) {
    todayItems.push({
      id: partnerId("today"), goalId: "onboarding", goalType: "system", title: goals.length ? "이번 주 계획 확인" : "첫 목표 입력하기",
      reason: goals.length ? "이번 주 목표와 마감을 확인하고 오늘 가능한 분량부터 시작합니다." : "내신·자격증·취업·활동 정보를 입력하면 12주 계획을 만들 수 있습니다.",
      dueAt: isoDate(today), durationMinutes: 20, priority: 1, status: "todo", source: "rules", action: goals.length ? "plan" : "goals",
    });
  }

  const plan = {
    versionId: partnerId("version"),
    inputSnapshotId: partnerId("snapshot"),
    createdAt: Date.now(),
    basedOnEventId: options.basedOnEventId || "",
    status: "draft",
    source: options.source || "rules",
    summary: goals.length
      ? `${goals.length}개의 목표와 주 ${Math.round(weekLimit / 60 * 10) / 10}시간의 가능 시간을 기준으로 12주 계획을 구성했습니다.`
      : "목표 정보가 부족해 첫 설정 행동만 제안합니다.",
    roadmap,
    weeks,
    today: { date: isoDate(today), availableMinutes: todayLimit, items: todayItems },
    constraints: {
      weeklyAvailableMinutes: weekLimit,
      dailyAvailableMinutes: normalized.profile.dailyAvailableMinutes,
      fixedSchedules: normalized.profile.fixedSchedules,
      sleepProtected: normalized.profile.sleepProtected !== false,
    },
    warnings: [],
  };
  return validatePartnerPlan(plan, normalized);
}

export function validatePartnerPlan(plan, state) {
  const normalized = normalizePartnerState(state);
  const weekLimit = weeklyAvailableMinutes(normalized);
  const output = JSON.parse(JSON.stringify(plan || {}));
  output.warnings = Array.isArray(output.warnings) ? output.warnings : [];
  output.weeks = Array.isArray(output.weeks) ? output.weeks.slice(0, 12) : [];
  output.roadmap = Array.isArray(output.roadmap) ? output.roadmap : [];
  output.today = output.today || { date: isoDate(new Date()), availableMinutes: todayAvailableMinutes(normalized), items: [] };
  output.today.items = Array.isArray(output.today.items) ? output.today.items.slice(0, 5) : [];

  for (const week of output.weeks) {
    week.items = Array.isArray(week.items) ? week.items : [];
    let total = week.items.reduce((sum, item) => sum + Math.max(0, Number(item.durationMinutes) || 0), 0);
    if (total > weekLimit && total > 0) {
      const ratio = weekLimit / total;
      week.items = week.items.map((item) => ({ ...item, durationMinutes: Math.max(20, Math.round(((Number(item.durationMinutes) || 30) * ratio) / 5) * 5) }));
      total = week.items.reduce((sum, item) => sum + item.durationMinutes, 0);
      output.warnings.push(`${week.startsAt || "해당 주"} 계획이 가능 시간을 초과해 자동 축소되었습니다.`);
    }
    week.totalMinutes = total;
  }

  const todayLimit = todayAvailableMinutes(normalized, dateAtNoon(output.today.date) || new Date());
  let todayTotal = output.today.items.reduce((sum, item) => sum + Math.max(0, Number(item.durationMinutes) || 0), 0);
  if (todayTotal > todayLimit && todayTotal > 0) {
    const ratio = todayLimit / todayTotal;
    output.today.items = output.today.items.map((item) => ({ ...item, durationMinutes: Math.max(15, Math.round(((Number(item.durationMinutes) || 20) * ratio) / 5) * 5) }));
    todayTotal = output.today.items.reduce((sum, item) => sum + item.durationMinutes, 0);
    output.warnings.push("오늘 계획이 가능 시간을 초과해 자동 축소되었습니다.");
  }
  output.today.availableMinutes = todayLimit;
  output.today.totalMinutes = todayTotal;
  output.validatedAt = Date.now();
  return output;
}

export function planDiff(before, after) {
  const oldItems = new Map((before?.weeks || []).flatMap((week) => week.items || []).map((item) => [item.goalId + ":" + item.title, item]));
  const nextItems = new Map((after?.weeks || []).flatMap((week) => week.items || []).map((item) => [item.goalId + ":" + item.title, item]));
  const added = [], removed = [], changed = [];
  nextItems.forEach((item, key) => {
    if (!oldItems.has(key)) added.push(item);
    else {
      const previous = oldItems.get(key);
      if (Number(previous.durationMinutes) !== Number(item.durationMinutes) || String(previous.dueAt || "") !== String(item.dueAt || "")) {
        changed.push({ before: previous, after: item });
      }
    }
  });
  oldItems.forEach((item, key) => { if (!nextItems.has(key)) removed.push(item); });
  return { added, removed, changed, summary: `추가 ${added.length} · 이동/분량 ${changed.length} · 제거 ${removed.length}` };
}

export function createPlanVersion(state, plan, { activate = false } = {}) {
  const normalized = normalizePartnerState(state);
  const version = validatePartnerPlan({ ...plan, versionId: plan.versionId || partnerId("version"), status: activate ? "active" : "draft" }, normalized);
  let versions = normalized.planVersions.map((item) => activate && item.status === "active" ? { ...item, status: "superseded" } : item);
  versions = [version, ...versions.filter((item) => item.versionId !== version.versionId)].slice(0, 30);
  return {
    ...normalized,
    planVersions: versions,
    activePlanVersionId: activate ? version.versionId : normalized.activePlanVersionId,
    pendingPlanVersionId: activate ? "" : version.versionId,
    lastUpdatedAt: Date.now(),
  };
}

export function confirmPendingPlan(state) {
  const normalized = normalizePartnerState(state);
  const pendingId = normalized.pendingPlanVersionId;
  if (!pendingId) return normalized;
  const versions = normalized.planVersions.map((item) => {
    if (item.versionId === pendingId) return { ...item, status: "active", confirmedAt: Date.now() };
    if (item.status === "active") return { ...item, status: "superseded" };
    return item;
  });
  return { ...normalized, planVersions: versions, activePlanVersionId: pendingId, pendingPlanVersionId: "", lastUpdatedAt: Date.now() };
}

export function rollbackPartnerPlan(state, targetVersionId) {
  const normalized = normalizePartnerState(state);
  const target = normalized.planVersions.find((item) => item.versionId === targetVersionId);
  if (!target) return normalized;
  const restored = { ...target, versionId: partnerId("version"), status: "active", createdAt: Date.now(), restoredFromVersionId: targetVersionId };
  const versions = [restored, ...normalized.planVersions.map((item) => item.status === "active" ? { ...item, status: "superseded" } : item)].slice(0, 30);
  return { ...normalized, planVersions: versions, activePlanVersionId: restored.versionId, pendingPlanVersionId: "", lastUpdatedAt: Date.now() };
}

export function getActivePartnerPlan(state) {
  const normalized = normalizePartnerState(state);
  return normalized.planVersions.find((item) => item.versionId === normalized.activePlanVersionId) || null;
}

export function getPendingPartnerPlan(state) {
  const normalized = normalizePartnerState(state);
  return normalized.planVersions.find((item) => item.versionId === normalized.pendingPlanVersionId) || null;
}

export function recordChangeEvent(state, event = {}) {
  const normalized = normalizePartnerState(state);
  const record = {
    id: event.id || partnerId("change"),
    type: event.type || "profile_updated",
    label: event.label || "정보가 변경되었습니다.",
    before: event.before ?? null,
    after: event.after ?? null,
    actor: event.actor || "student",
    createdAt: event.createdAt || Date.now(),
  };
  return { ...normalized, changeEvents: [record, ...normalized.changeEvents].slice(0, 100), lastUpdatedAt: Date.now() };
}

export function updateTodayItemStatus(state, itemId, status, result = {}) {
  const normalized = normalizePartnerState(state);
  const activeId = normalized.activePlanVersionId;
  if (!activeId) return normalized;
  const versions = normalized.planVersions.map((version) => {
    if (version.versionId !== activeId) return version;
    return {
      ...version,
      today: {
        ...version.today,
        items: (version.today?.items || []).map((item) => item.id === itemId ? { ...item, status, result, updatedAt: Date.now() } : item),
      },
    };
  });
  return { ...normalized, planVersions: versions, lastUpdatedAt: Date.now() };
}

export function mergeAiPlan(aiPlan, fallbackPlan, state) {
  if (!aiPlan || typeof aiPlan !== "object") return fallbackPlan;
  const safe = JSON.parse(JSON.stringify(fallbackPlan));
  safe.summary = String(aiPlan.summary || safe.summary || "").trim() || fallbackPlan.summary;
  safe.source = "ai+rules";
  safe.createdAt = Date.now();
  safe.status = "draft";
  safe.warnings = [...new Set([...(safe.warnings || []), ...(Array.isArray(aiPlan.warnings) ? aiPlan.warnings.map(String) : [])])].slice(0, 8);

  const aiRoadmap = Array.isArray(aiPlan.roadmap) ? aiPlan.roadmap : [];
  safe.roadmap = safe.roadmap.map((goal) => {
    const suggested = aiRoadmap.find((item) => item?.goalId === goal.goalId) || aiRoadmap.find((item) => item?.title === goal.title);
    if (!suggested) return goal;
    const suggestedMilestones = Array.isArray(suggested.milestones) ? suggested.milestones : [];
    return {
      ...goal,
      milestones: goal.milestones.map((milestone, index) => ({
        ...milestone,
        reason: String(suggestedMilestones[index]?.reason || milestone.reason || "").trim() || milestone.reason,
        priority: Number.isFinite(Number(suggestedMilestones[index]?.priority)) ? Math.max(0.1, Math.min(1, Number(suggestedMilestones[index].priority))) : milestone.priority,
      })),
    };
  });

  const aiWeeks = Array.isArray(aiPlan.weeks) ? aiPlan.weeks : [];
  safe.weeks = safe.weeks.map((week) => {
    const suggestedWeek = aiWeeks.find((item) => Number(item?.weekIndex) === Number(week.weekIndex)) || aiWeeks[week.weekIndex];
    if (!suggestedWeek || !Array.isArray(suggestedWeek.items)) return week;
    return {
      ...week,
      items: week.items.map((item, index) => {
        const suggested = suggestedWeek.items.find((candidate) => candidate?.goalId === item.goalId && candidate?.title === item.title) || suggestedWeek.items[index];
        if (!suggested) return item;
        return {
          ...item,
          reason: String(suggested.reason || item.reason || "").trim() || item.reason,
          priority: Number.isFinite(Number(suggested.priority)) ? Math.max(0.1, Math.min(1, Number(suggested.priority))) : item.priority,
          durationMinutes: Number.isFinite(Number(suggested.durationMinutes)) ? Math.max(15, Math.min(120, Number(suggested.durationMinutes))) : item.durationMinutes,
        };
      }),
    };
  });

  if (Array.isArray(aiPlan.today?.items) && aiPlan.today.items.length) {
    safe.today.items = safe.today.items.map((item, index) => {
      const suggested = aiPlan.today.items.find((candidate) => candidate?.goalId === item.goalId && candidate?.title === item.title) || aiPlan.today.items[index];
      if (!suggested) return item;
      return {
        ...item,
        reason: String(suggested.reason || item.reason || "").trim() || item.reason,
        priority: Number.isFinite(Number(suggested.priority)) ? Math.max(0.1, Math.min(1, Number(suggested.priority))) : item.priority,
        durationMinutes: Number.isFinite(Number(suggested.durationMinutes)) ? Math.max(15, Math.min(75, Number(suggested.durationMinutes))) : item.durationMinutes,
      };
    });
  }

  return validatePartnerPlan(safe, state);
}

export function partnerCalendarItems(state) {
  const normalized = normalizePartnerState(state);
  const items = [];
  normalized.goals.forEach((item) => item?.deadline && items.push({ id: item.id || partnerId("cal"), type: inferGoalType(item), title: item.title, date: item.deadline, locked: false }));
  normalized.certificateGoals.forEach((item) => item?.examDate && items.push({ id: `certificate-exam:${item.id || item.name}`, type: "certificate", title: `${item.name} 시험`, date: item.examDate, locked: true }));
  normalized.calendarExtras.forEach((item) => item?.date && items.push(item));
  return items.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function todayLabel(date = new Date()) {
  const key = DAY_KEYS[date.getDay()];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${DAY_LABELS[key]}요일`;
}
