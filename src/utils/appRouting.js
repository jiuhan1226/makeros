const PAGE_TO_PATH = {
  partnerToday: "today",
  partnerPlan: "plan",
  partnerCalendar: "calendar",
  timetable: "timetable",
  meals: "meals",
  partnerGoals: "goals",
  catalog: "certificates",
  certificate: "certificate",
  past: "past-exams",
  subject: "subjects",
  all: "all-questions",
  saved: "bookmarks",
  bookmark: "wrong-review",
  learning: "recommended",
  planner: "exam-plan",
  report: "report",
  search: "cbt-search",
  library: "school",
  pdfstudy: "pdf-study",
  notes: "notes",
  graph: "concept-tree",
  tutor: "tutor",
  knowledge: "search",
  makerHome: "maker",
  invent: "invent",
  projects: "projects",
  portfolio: "portfolio",
  opportunities: "opportunities",
  career: "career",
  data: "data",
  mode: "exam-mode",
  exam: "exam",
  mock: "mock-exam",
  admin: "admin",
};

const PATH_TO_PAGE = Object.fromEntries(Object.entries(PAGE_TO_PATH).map(([page, path]) => [path, page]));
PATH_TO_PAGE.topic = "all";

export function pageToHash(page) {
  return `#/${PAGE_TO_PATH[page] || PAGE_TO_PATH.partnerToday}`;
}

export function pageFromLocation(locationLike = globalThis.location) {
  const raw = String(locationLike?.hash || "").replace(/^#\/?/, "").split(/[?&]/)[0];
  return PATH_TO_PAGE[raw] || "partnerToday";
}

export function isKnownPage(page) {
  return Object.prototype.hasOwnProperty.call(PAGE_TO_PATH, page);
}
