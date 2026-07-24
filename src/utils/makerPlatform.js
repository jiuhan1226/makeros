const KEY = "makeros-product-v0.1";

const defaultResumeProfile = {
  name: "",
  school: "",
  major: "",
  grade: "",
  email: "",
  phone: "",
  location: "",
  desiredRole: "",
  introduction: "",
  skills: [],
};

export function readMakerState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      inventorProjects: Array.isArray(parsed.inventorProjects) ? parsed.inventorProjects : [],
      buildProjects: Array.isArray(parsed.buildProjects) ? parsed.buildProjects : [],
      portfolioItems: Array.isArray(parsed.portfolioItems) ? parsed.portfolioItems : [],
      awards: Array.isArray(parsed.awards) ? parsed.awards : [],
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
      resumeProfile: parsed.resumeProfile && typeof parsed.resumeProfile === "object"
        ? { ...defaultResumeProfile, ...parsed.resumeProfile }
        : { ...defaultResumeProfile },
      careerProfile: parsed.careerProfile && typeof parsed.careerProfile === "object" ? parsed.careerProfile : {},
    };
  } catch {
    return {
      inventorProjects: [],
      buildProjects: [],
      portfolioItems: [],
      awards: [],
      certifications: [],
      resumeProfile: { ...defaultResumeProfile },
      careerProfile: {},
    };
  }
}

export function saveMakerState(state) {
  localStorage.setItem(KEY, JSON.stringify({
    inventorProjects: state.inventorProjects || [],
    buildProjects: state.buildProjects || [],
    portfolioItems: state.portfolioItems || [],
    awards: state.awards || [],
    certifications: state.certifications || [],
    resumeProfile: { ...defaultResumeProfile, ...(state.resumeProfile || {}) },
    careerProfile: state.careerProfile || {},
  }));
  window.dispatchEvent(new CustomEvent("makeros:state"));
}

export function createInventorProject() {
  const now = Date.now();
  return {
    id: `invent-${now}`,
    title: "새 발명 아이디어",
    status: "draft",
    stage: 1,
    createdAt: now,
    updatedAt: now,
    problem: {
      situation: "",
      targetUser: "",
      inconvenience: "",
      frequency: "",
      impact: "",
    },
    causes: [],
    causeEvidence: "",
    solution: {
      concept: "",
      mechanism: "",
      constraints: "",
      improvements: "",
    },
    keywords: [],
    searchQueries: { ko: [], en: [] },
    priorArtNotes: "",
    comparison: [],
    analysis: null,
    rightsDraft: null,
    aiHistory: [],
  };
}

export function createBuildProject(source = {}) {
  const now = Date.now();
  return {
    id: `build-${now}`,
    sourceInventId: source.sourceInventId || "",
    title: source.title || "새 프로젝트",
    problem: source.problem || "",
    solution: source.solution || "",
    status: source.status || "active",
    createdAt: now,
    updatedAt: now,
    startDate: source.startDate || "",
    endDate: source.endDate || "",
    role: source.role || "",
    teamSize: source.teamSize || "",
    techStack: Array.isArray(source.techStack) ? source.techStack : [],
    resumeSummary: source.resumeSummary || "",
    outcome: source.outcome || "",
    tasks: Array.isArray(source.tasks) ? source.tasks : [],
    journals: Array.isArray(source.journals) ? source.journals : [],
  };
}

export function inventStageLabel(stage) {
  return ["", "문제 발견", "원인 분석", "아이디어 구체화", "검색 키워드", "선행기술 비교", "가능성 분석", "권리화 연결"][stage] || "발명 프로젝트";
}
