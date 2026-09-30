import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  auth,
  firebaseConfigured,
  getExamQuestions,
  isAdminUser,
  listCertificates,
  listExams,
  loadCloudState,
  loadCloudWorkspace,
  listUserAttemptEvents,
  onAuthStateChanged,
  saveCloudState,
  saveCloudWorkspace,
  saveCloudPdfLibrary,
  saveQuestionProgress,
  replaceCloudLearningProgress,
  clearCloudLearningData,
  deleteMyAccountAndData,
} from "./firebase";
import AppHeader from "./components/AppHeader";
import AuthModal from "./components/AuthModal";
import TutorialModal, { shouldShowTutorial } from "./components/TutorialModal";
import FeedbackCenter from "./components/FeedbackCenter";
import CatalogPage from "./pages/CatalogPage";
import CertificateHomePage from "./pages/CertificateHomePage";
import PastExamsPage from "./pages/PastExamsPage";
import ModeSelectPage from "./pages/ModeSelectPage";
import ExamPage from "./pages/ExamPage";
import MockExamPage from "./pages/MockExamPage";
import BookmarkPage from "./pages/BookmarkPage";
import SearchPage from "./pages/SearchPage";
import PlannerPage from "./pages/PlannerPage";
import LearningCenterPage from "./pages/LearningCenterPage";
import AllQuestionsPage from "./pages/AllQuestionsPage";
import SavedBookmarksPage from "./pages/SavedBookmarksPage";
import SubjectStudyPage from "./pages/SubjectStudyPage";
import UnifiedSearchPage from "./pages/UnifiedSearchPage";
import GrowthReportPage from "./pages/GrowthReportPage";
import MakerHomePage from "./pages/MakerHomePage";
import PartnerTodayPage from "./pages/PartnerTodayPage";
import PartnerPlanPage from "./pages/PartnerPlanPage";
import PartnerCalendarPage from "./pages/PartnerCalendarPage";
import PartnerGoalsPage from "./pages/PartnerGoalsPage";
import DataManagementPage from "./pages/DataManagementPage";
import { shuffle } from "./utils/exam";
import { useExamSession } from "./hooks/useExamSession";
import { assetId, hydratePdfLibrary, readPdfLibrary, readStudyAssets, savePdfLibrary, saveStudyAssets } from "./utils/studyPlatform";
import { createBuildProject as makeBuildProject, readMakerState, saveMakerState } from "./utils/makerPlatform";
import { generateStudyAssetsFromPages } from "./utils/aiStudyAssets";
import { postJson } from "./utils/api";
import { notifyUser } from "./utils/uiFeedback";
import {
  buildDeterministicPlan,
  confirmPendingPlan,
  createDefaultPartnerState,
  createPlanVersion,
  getActivePartnerPlan,
  mergeAiPlan,
  normalizePartnerState,
  planDiff,
  profileSnapshot,
  recordChangeEvent,
  rollbackPartnerPlan,
  adjustTodayPlanItem,
  rolloverPartnerDay,
  setPartnerDayOff,
  transferPlanProgress,
  updateTodayItemStatus,
} from "./utils/aiPartner";
import { pageFromLocation, pageToHash } from "./utils/appRouting";
import {
  buildRepeatedWrong,
  getDueReviews,
  getQuestionTags,
  inferQuestionDifficulty,
  mergeLearningProgress,
  mergeWrongAttempts,
  migrateLearningState,
  questionProgressId,
  resolveLearningType,
  resolveStudyScope,
} from "./utils/learningEngine";
import {
  buildMaintenanceResult,
  filterCertificateAttempts,
  mergeAttemptEvents,
} from "./utils/learningMaintenance";
import {
  buildCertificateShortcuts,
  certificateUnavailableReason,
  findCertificateForGoal,
} from "./utils/certificateRouting";
import { deduplicateQuestions, questionContentKey, removeQuestionFromList } from "./utils/questionDedup";
import { CBT_ROUND_SIZE, calculateCbtBlockProgress, selectContinuousPastQuestions, roundQuestionCount } from "./utils/continuousCbt";
import { applyDailyCbtProgress, studySessionSnapshot, upsertStudySession } from './utils/cbtStudyLedger';
import "./styles.css";

const AdminPage = lazy(() => import("./pages/AdminPage"));
const PdfLibraryPage = lazy(() => import("./pages/PdfLibraryPage"));
const PdfStudyPage = lazy(() => import("./pages/PdfStudyPage"));
const NotesCardsPage = lazy(() => import("./pages/NotesCardsPage"));
const AiTutorPage = lazy(() => import("./pages/AiTutorPage"));
const KnowledgeGraphPage = lazy(() => import("./pages/KnowledgeGraphPage"));
const InventPage = lazy(() => import("./pages/InventPage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const PortfolioPage = lazy(() => import("./pages/PortfolioPage"));
const OpportunitiesPage = lazy(() => import("./pages/OpportunitiesPage"));
const CareerPage = lazy(() => import("./pages/CareerPage"));
const TimetablePage = lazy(() => import("./pages/TimetablePage"));
const MealPage = lazy(() => import("./pages/MealPage"));

class PageErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("MakerOS page error", error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return <main className="loading-page"><section className="maker-error route-error"><strong>화면을 불러오지 못했습니다.</strong><p>입력한 내용은 저장되어 있습니다. 화면만 다시 불러와 주세요.</p><button type="button" onClick={() => window.location.reload()}>다시 불러오기</button></section></main>;
  }
}

const LOCAL_KEY = "studylock-v3-state";
const LEGACY_PDF_KEY = "studylock-v1.5-state";
const PARTNER_KEY = "makeros-ai-partner-v3.1";

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}"); }
  catch { return {}; }
}

function readLegacyPdf() {
  try { return JSON.parse(localStorage.getItem(LEGACY_PDF_KEY) || "{}"); }
  catch { return {}; }
}

function readPartnerLocal() {
  try { return normalizePartnerState(JSON.parse(localStorage.getItem(PARTNER_KEY) || "{}")); }
  catch { return createDefaultPartnerState(); }
}

function sameCertificate(item, certificateId, examIds) {
  if (!certificateId) return true;
  return item?.certificateId ? item.certificateId === certificateId : examIds.has(item?.examId);
}

function progressToQuestion(item, index = 0) {
  return {
    id: item.questionId || item.id || `review-${index}`,
    examId: item.examId || "",
    certificateId: item.certificateId || "",
    certificateName: item.certificateName || "",
    questionNumber: index + 1,
    subject: item.subject || "공통",
    topic: item.topic || "",
    tags: item.tags || [],
    question: item.question || "복습 문제",
    choices: Array.isArray(item.choices) ? item.choices : [],
    answerIndex: Number(item.correctAnswerIndex ?? item.answerIndex),
    explanation: item.explanation || "",
  };
}

function App() {
  const initial = useRef(migrateLearningState(readLocal())).current;
  const makerInitial = useRef(readMakerState()).current;
  const [page, setPage] = useState(() => pageFromLocation());
  const [certificates, setCertificates] = useState([]);
  const [certificatesLoaded, setCertificatesLoaded] = useState(false);
  const [certificate, setCertificate] = useState(null);
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [examStartBusy, setExamStartBusy] = useState(false);
  const [examStartError, setExamStartError] = useState("");
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showTutorial, setShowTutorial] = useState(shouldShowTutorial);
  const [history, setHistory] = useState(initial.history || []);
  const [practiceHistory, setPracticeHistory] = useState(initial.practiceHistory || []);
  const [wrongNotes, setWrongNotes] = useState(initial.wrongNotes || []);
  const [learningProgress, setLearningProgress] = useState(initial.learningProgress || []);
  const [studyEvents, setStudyEvents] = useState(initial.studyEvents || []);
  const [attemptEvents, setAttemptEvents] = useState(initial.attemptEvents || []);
  const [plan, setPlan] = useState(initial.plan || {});
  const [questionBookmarks, setQuestionBookmarks] = useState(initial.questionBookmarks || []);
  const [pdfQuizHistory, setPdfQuizHistory] = useState(initial.pdfQuizHistory || []);
  const [pdfQuizWrongNotes, setPdfQuizWrongNotes] = useState(initial.pdfQuizWrongNotes || []);
  const [graphQuery, setGraphQuery] = useState("");
  const [tutorSeed, setTutorSeed] = useState({ question: "", pdfId: "" });
  const [assetFocus, setAssetFocus] = useState(null);
  const [pdfLibrary, setPdfLibrary] = useState(readPdfLibrary());
  const [assets, setAssets] = useState(readStudyAssets());
  const [assetBusy, setAssetBusy] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudLoadedForUid, setCloudLoadedForUid] = useState("");
  const [activeCertificateId, setActiveCertificateId] = useState(initial.activeCertificateId || "");
  const [inventorProjects, setInventorProjects] = useState(makerInitial.inventorProjects || []);
  const [buildProjects, setBuildProjects] = useState(makerInitial.buildProjects || []);
  const [portfolioItems, setPortfolioItems] = useState(makerInitial.portfolioItems || []);
  const [awards, setAwards] = useState(makerInitial.awards || []);
  const [certifications, setCertifications] = useState(makerInitial.certifications || []);
  const [resumeProfile, setResumeProfile] = useState(makerInitial.resumeProfile || {});
  const [careerProfile, setCareerProfile] = useState(makerInitial.careerProfile || {});
  const [opportunityBookmarks, setOpportunityBookmarks] = useState(makerInitial.opportunityBookmarks || []);
  const [partnerState, setPartnerState] = useState(() => readPartnerLocal());
  const [workspaceSyncStatus, setWorkspaceSyncStatus] = useState("device");
  const [learningSyncStatus, setLearningSyncStatus] = useState("device");
  const syncStatus = !user ? "device"
    : [workspaceSyncStatus, learningSyncStatus].includes("error") ? "error"
    : [workspaceSyncStatus, learningSyncStatus].includes("loading") ? "loading"
    : workspaceSyncStatus === "synced" && learningSyncStatus === "synced" ? "synced" : "saving";
  const [partnerBusy, setPartnerBusy] = useState(false);
  const [partnerLearningAction, setPartnerLearningAction] = useState({ itemId: "", status: "idle", message: "" });
  const [planFocusGoalId, setPlanFocusGoalId] = useState("");
  const [academicGoalContext, setAcademicGoalContext] = useState(null);
  const knownPartnerCertificateGoalIds = useRef(null);
  const session = useExamSession({ userId: user?.uid || "", active: page === 'exam' });
  const recordedSessionIds = useRef(new Set());
  const cbtLaunchBusy = useRef(false);
  const activePlanDate = getActivePartnerPlan(partnerState)?.today?.date;
  useEffect(() => {
    if (!session.restoring && session.exam?.studyBlockDate && activePlanDate
      && session.exam.studyBlockDate !== activePlanDate) {
      saveStudyBlockProgress(false, true);
      session.detachDailyBlock();
    }
  }, [session.restoring, session.exam?.studyBlockDate, activePlanDate]);
  useEffect(() => {
    if (!session.restoring && session.lastSavedAt && session.exam?.studyBlockTargetMinutes) saveStudyBlockProgress();
  }, [session.lastSavedAt, session.restoring]);
  useEffect(() => {
    if (session.restoring || !session.exam?.studyBlockTargetMinutes) return;
    recordAnsweredProgress(session.questions.map((question, index) => ({ question, index, answer: session.answers[index] })).filter((entry) => entry.answer !== undefined), resolveStudyScope(session.exam, session.mode));
  }, [session.answers, session.restoring]);
  const partnerCertificateGoals = useMemo(() => normalizePartnerState(partnerState).certificateGoals, [partnerState]);
  const certificateShortcuts = useMemo(
    () => buildCertificateShortcuts(partnerCertificateGoals, certificates),
    [certificates, partnerCertificateGoals],
  );

  useEffect(() => {
    if (!window.location.hash) window.history.replaceState({ page }, "", pageToHash(page));
    const restoreRoute = () => setPage(pageFromLocation());
    window.addEventListener("popstate", restoreRoute);
    window.addEventListener("hashchange", restoreRoute);
    return () => {
      window.removeEventListener("popstate", restoreRoute);
      window.removeEventListener("hashchange", restoreRoute);
    };
  }, []);
  useEffect(() => {
    const nextHash = pageToHash(page);
    if (window.location.hash !== nextHash) window.history.pushState({ page }, "", nextHash);
  }, [page]);
  useEffect(() => {
    if (page === "exam" && !session.exam && !session.restoring) setPage("partnerToday");
    if (page === "mode" && !selectedExam) setPage(certificate ? "past" : "catalog");
  }, [certificate, page, selectedExam, session.exam, session.restoring]);

  useEffect(() => {
    const refreshToday = () => setPartnerState((previous) => rolloverPartnerDay(previous, { today: new Date() }));
    refreshToday();
    const timer = window.setInterval(refreshToday, 60_000);
    const handleVisibility = () => { if (document.visibilityState === "visible") refreshToday(); };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => (firebaseConfigured ? onAuthStateChanged(auth, setUser) : undefined), []);
  useEffect(() => {
    const showLogin = () => setShowAuth(true);
    window.addEventListener("makeros:login-required", showLogin);
    return () => window.removeEventListener("makeros:login-required", showLogin);
  }, []);
  useEffect(() => {
    let alive = true;
    listCertificates()
      .then((items) => { if (alive) setCertificates(items); })
      .catch(console.error)
      .finally(() => { if (alive) setCertificatesLoaded(true); });
    return () => { alive = false; };
  }, []);
  useEffect(() => { if (certificate) listExams(certificate.id).then(setExams).catch(console.error); }, [certificate]);
  useEffect(() => {
    if (!certificatesLoaded) return;
    const currentIds = new Set(partnerCertificateGoals.map((goal) => String(goal.id || "")));
    const previousIds = knownPartnerCertificateGoalIds.current;
    const added = previousIds
      ? partnerCertificateGoals.filter((goal) => !previousIds.has(String(goal.id || "")))
      : [...partnerCertificateGoals].sort((a, b) => String(a.examDate || "9999-12-31").localeCompare(String(b.examDate || "9999-12-31")));
    knownPartnerCertificateGoalIds.current = currentIds;
    const targetGoal = previousIds
      ? [...added].reverse().find((goal) => findCertificateForGoal(goal, certificates))
      : added.find((goal) => findCertificateForGoal(goal, certificates));
    const matched = findCertificateForGoal(targetGoal, certificates);
    if (matched && certificate?.id !== matched.id) {
      setCertificate(matched);
      setActiveCertificateId(matched.id || "");
    }
  }, [certificate?.id, certificates, certificatesLoaded, partnerCertificateGoals]);
  useEffect(() => {
    let active = true;
    hydratePdfLibrary()
      .then((items) => { if (active) setPdfLibrary(items); })
      .catch((error) => console.warn("PDF 학습 자료를 불러오지 못했습니다.", error));
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const sync = () => { setPdfLibrary(readPdfLibrary()); setAssets(readStudyAssets()); };
    window.addEventListener("studylock:pdf-library", sync);
    window.addEventListener("studylock:study-assets", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("studylock:pdf-library", sync);
      window.removeEventListener("studylock:study-assets", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  useEffect(() => {
    if (!user) { setCloudLoadedForUid(""); setCloudReady(true); setWorkspaceSyncStatus("device"); setLearningSyncStatus("device"); return; }
    setCloudLoadedForUid("");
    setCloudReady(false);
    setWorkspaceSyncStatus("loading");
    setLearningSyncStatus("loading");
    Promise.all([
      loadCloudState(user.uid),
      listUserAttemptEvents(user.uid),
      loadCloudWorkspace(user.uid),
    ])
      .then(([data, cloudAttempts, workspace]) => {
        if (data) {
          const migrated = migrateLearningState(data);
          setHistory(migrated.history || []);
          setPracticeHistory(migrated.practiceHistory || []);
          setWrongNotes(migrated.wrongNotes || []);
          setLearningProgress(migrated.learningProgress || []);
          setStudyEvents(migrated.studyEvents || []);
          setPlan(migrated.plan || {});
          setQuestionBookmarks(migrated.questionBookmarks || []);
          setPdfQuizHistory(migrated.pdfQuizHistory || data.pdfQuizHistory || []);
          setPdfQuizWrongNotes(migrated.pdfQuizWrongNotes || data.pdfQuizWrongNotes || []);
          setActiveCertificateId(String(migrated.activeCertificateId || data.activeCertificateId || ""));
          if (data.partnerState) setPartnerState(normalizePartnerState(data.partnerState));
        }
        if (cloudAttempts.length) setAttemptEvents(cloudAttempts);
        if (workspace?.makerState) {
          const maker = workspace.makerState;
          setInventorProjects(maker.inventorProjects || []);
          setBuildProjects(maker.buildProjects || []);
          setPortfolioItems(maker.portfolioItems || []);
          setAwards(maker.awards || []);
          setCertifications(maker.certifications || []);
          setResumeProfile(maker.resumeProfile || {});
          setCareerProfile(maker.careerProfile || {});
          setOpportunityBookmarks(maker.opportunityBookmarks || []);
        }
        if (workspace?.studyAssets) saveStudyAssets(workspace.studyAssets);
        if (workspace) savePdfLibrary(workspace.pdfLibrary || []);
        setCloudLoadedForUid(user.uid);
        setCloudReady(true);
        setWorkspaceSyncStatus("synced");
        setLearningSyncStatus("synced");
      })
      .catch((error) => {
        // 다운로드가 실패했을 때 빈 로컬 상태를 새 계정 데이터로 덮어쓰지 않습니다.
        console.warn("계정 데이터를 불러오지 못했습니다. 저장을 중단합니다.", error);
        setCloudLoadedForUid(""); setCloudReady(false);
        setWorkspaceSyncStatus("error"); setLearningSyncStatus("error");
      });
  }, [user]);
  useEffect(() => {
    if (!activeCertificateId || !certificates.length) return;
    const target = certificates.find((item) => item.id === activeCertificateId);
    if (target && certificate?.id !== target.id) setCertificate(target);
  }, [activeCertificateId, certificates, certificate?.id]);

  useEffect(() => {
    const state = {
      history,
      practiceHistory,
      wrongNotes,
      learningProgress,
      studyEvents,
      attemptEvents,
      plan,
      questionBookmarks,
      pdfQuizHistory,
      pdfQuizWrongNotes,
      activeCertificateId: certificate?.id || activeCertificateId,
    };
    let localSaved = true;
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); }
    catch (error) { localSaved = false; setLearningSyncStatus("error"); console.warn("이 기기에 학습 상태를 저장하지 못했습니다.", error); }
    if (user && cloudReady && cloudLoadedForUid === user.uid) {
      if (localSaved) setLearningSyncStatus("saving");
      const cloudState = { history, practiceHistory, wrongNotes, learningProgress, studyEvents, plan, questionBookmarks, pdfQuizHistory, pdfQuizWrongNotes, activeCertificateId: certificate?.id || activeCertificateId, partnerState };
      let active = true;
      const id = setTimeout(() => saveCloudState(user.uid, cloudState)
        .then(() => { if (active && localSaved) setLearningSyncStatus("synced"); })
        .catch((error) => { if (active) setLearningSyncStatus("error"); console.error("학습 상태 계정 저장 실패", error); }), 500);
      return () => { active = false; clearTimeout(id); };
    }
    return undefined;
  }, [history, practiceHistory, wrongNotes, learningProgress, studyEvents, attemptEvents, plan, questionBookmarks, pdfQuizHistory, pdfQuizWrongNotes, activeCertificateId, certificate?.id, partnerState, user, cloudReady, cloudLoadedForUid]);
  useEffect(() => {
    const makerState = { inventorProjects, buildProjects, portfolioItems, awards, certifications, resumeProfile, careerProfile, opportunityBookmarks };
    let localSaved = true;
    try { saveMakerState(makerState); }
    catch (error) { localSaved = false; setWorkspaceSyncStatus("error"); console.warn("이 기기에 작업공간을 저장하지 못했습니다.", error); }
    if (user && cloudReady && cloudLoadedForUid === user.uid) {
      if (localSaved) setWorkspaceSyncStatus("saving");
      let active = true;
      const id = setTimeout(() => {
        Promise.all([
          saveCloudWorkspace(user.uid, { makerState, studyAssets: assets }),
          saveCloudPdfLibrary(user.uid, pdfLibrary),
        ])
          .then(() => { if (active && localSaved) setWorkspaceSyncStatus("synced"); })
          .catch((error) => { if (active) setWorkspaceSyncStatus("error"); console.warn("작업공간 계정 저장 실패", error); });
      }, 900);
      return () => { active = false; clearTimeout(id); };
    }
    return undefined;
  }, [inventorProjects, buildProjects, portfolioItems, awards, certifications, resumeProfile, careerProfile, opportunityBookmarks, assets, pdfLibrary, user, cloudReady, cloudLoadedForUid]);
  useEffect(() => {
    try { localStorage.setItem(PARTNER_KEY, JSON.stringify(partnerState)); }
    catch (error) { setLearningSyncStatus("error"); console.warn("이 기기에 계획을 저장하지 못했습니다.", error); }
  }, [partnerState]);

  const active = useMemo(
    () => page === "mode" ? "past" : page === "exam" ? (session.exam?.sourceType === "pdf" ? "pdfstudy" : "past") : page,
    [page, session.exam?.sourceType],
  );
  const legacyPdf = readLegacyPdf();
  const pdfWrongNotes = (legacyPdf.wrongNotes || []).filter((question) => !question.examId);
  const savedBookmarks = useMemo(
    () => deduplicateQuestions(questionBookmarks).questions,
    [questionBookmarks],
  );
  const savedBookmarkKeys = useMemo(
    () => new Set(questionBookmarks.map((question, index) => questionContentKey(question, index))),
    [questionBookmarks],
  );
  const progressMap = useMemo(
    () => new Map(learningProgress.map((item) => [item.questionId, item])),
    [learningProgress],
  );

  const certificateExamIds = useMemo(() => new Set(exams.map((exam) => exam.id)), [exams]);
  const certificateHistory = useMemo(
    () => history.filter((item) => sameCertificate(item, certificate?.id, certificateExamIds)),
    [certificate?.id, certificateExamIds, history],
  );
  const certificatePracticeHistory = useMemo(
    () => practiceHistory.filter((item) => sameCertificate(item, certificate?.id, certificateExamIds)),
    [certificate?.id, certificateExamIds, practiceHistory],
  );
  const certificateWrongNotes = useMemo(
    () => wrongNotes.filter((item) => sameCertificate(item, certificate?.id, certificateExamIds)),
    [certificate?.id, certificateExamIds, wrongNotes],
  );
  const certificateStudyEvents = useMemo(
    () => studyEvents.filter((item) => sameCertificate(item, certificate?.id, certificateExamIds)),
    [certificate?.id, certificateExamIds, studyEvents],
  );
  const certificateLearningProgress = useMemo(
    () => learningProgress.filter((item) => sameCertificate(item, certificate?.id, certificateExamIds)),
    [certificate?.id, certificateExamIds, learningProgress],
  );
  const certificateBookmarks = useMemo(
    () => savedBookmarks.filter((item) => sameCertificate(item, certificate?.id, certificateExamIds)),
    [certificate?.id, certificateExamIds, savedBookmarks],
  );
  const certificateActiveSession = useMemo(() => {
    if (!session.resumable || !session.exam || !session.questions.length) return null;
    if (!sameCertificate(session.exam, certificate?.id, certificateExamIds)) return null;
    return {
      examId: session.exam.id || "",
      title: session.exam.title || "CBT 학습",
      certificateId: session.exam.certificateId || certificate?.id || "",
      current: Math.min(session.current + 1, session.questions.length),
      total: session.questions.length,
      answered: Object.values(session.answers || {}).filter((value) => value !== undefined).length,
      savedAt: session.lastSavedAt || session.startedAt || Date.now(),
      mode: session.mode,
    };
  }, [certificate?.id, certificateExamIds, session.answers, session.current, session.exam, session.lastSavedAt, session.mode, session.questions.length, session.resumable, session.startedAt]);
  const certificateDraftSessions = useMemo(() => session.drafts.filter((item) => sameCertificate(item, certificate?.id, certificateExamIds)), [certificate?.id, certificateExamIds, session.drafts]);

  async function resumeExamDraft(checkpointKey) {
    const resumed = await session.resumeDraft(checkpointKey);
    if (resumed) setPage("exam");
  }

  async function selectCertificate(nextCertificate) {
    setCertificate(nextCertificate);
    setActiveCertificateId(nextCertificate?.id || "");
    setPage("certificate");
  }

  async function openExam(exam) {
    setSelectedExam(exam);
    setPage("mode");
  }

  async function startExam(mode) {
    if (examStartBusy) return;
    setExamStartBusy(true);
    setExamStartError("");
    try {
      if (!selectedExam?.id) throw new Error("선택한 시험을 찾을 수 없습니다. 기출 목록에서 다시 선택해 주세요.");
      const questions = await getExamQuestions(selectedExam.id);
      if (!Array.isArray(questions) || !questions.length) throw new Error("이 회차에는 불러올 수 있는 문제가 없습니다. 다른 회차를 선택하거나 잠시 후 다시 시도해 주세요.");
      const practice = mode === "연습모드";
      const started = session.start({
        ...selectedExam,
        assessmentType: practice ? "practice" : "exam",
        studyScope: practice ? "exam-practice" : "exam",
        learningType: practice ? "examPractice" : "exam",
        returnPage: "past",
      }, questions, mode);
      if (started !== false) setPage("exam");
    } catch (error) {
      setExamStartError(error?.message || "문제를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally { setExamStartBusy(false); }
  }

  function enrichLearningPayload(payload) {
    const studyScope = payload.studyScope || resolveStudyScope(payload.exam, payload.mode);
    return {
      ...payload,
      studyScope,
      learningType: payload.learningType || resolveLearningType(payload.exam, payload.mode, studyScope),
      sessionId: payload.sessionId || String(session.startedAt || ""),
    };
  }

  function saveProgressLocally(payload) {
    const enriched = enrichLearningPayload(payload);
    setLearningProgress((previous) => mergeLearningProgress(previous, enriched));
    setAttemptEvents((previous) => mergeAttemptEvents(previous, enriched));
  }

  async function saveConfidenceRecord(payload) {
    const enriched = enrichLearningPayload(payload);
    saveProgressLocally(enriched);
    if (user?.uid) {
      saveQuestionProgress({ uid: user.uid, ...enriched }).catch((error) => console.error("Firestore 학습 기록 저장 실패", error));
    }
  }

  function getDifficulty(question) {
    return inferQuestionDifficulty(progressMap.get(questionProgressId(question)) || {});
  }

  function recordAnsweredProgress(answeredEntries, scope) {
    const learningType = resolveLearningType(session.exam || {}, session.mode, scope);
    const payloads = answeredEntries.map(({ question, index, answer }) => {
      const isCorrect = Number(answer) === Number(question.answerIndex);
      const confidence = session.confidenceByQuestion[question.id] || (isCorrect ? "medium" : "low");
      return enrichLearningPayload({
        question,
        exam: { ...session.exam, learningType },
        mode: session.mode,
        studyScope: scope,
        learningType,
        sessionId: String(session.startedAt || ""),
        attemptId: `${session.startedAt}:${question.id || index}`,
        selectedAnswerIndex: answer,
        isCorrect,
        confidence,
      });
    });

    setLearningProgress((previous) => payloads.reduce(
      (current, payload) => mergeLearningProgress(current, payload),
      previous,
    ));
    setAttemptEvents((previous) => payloads.reduce(
      (current, payload) => mergeAttemptEvents(current, payload),
      previous,
    ));

    if (user?.uid) {
      payloads.forEach((payload) => {
        saveQuestionProgress({ uid: user.uid, ...payload }).catch(console.error);
      });
    }
  }

  function saveStudyBlockProgress(endedEarly = false, final = false) {
    if (!session.exam?.studyBlockTargetMinutes) return;
    const snapshot = { ...studySessionSnapshot(session, { date: getActivePartnerPlan(partnerState)?.today?.date, endedEarly }), final };
    setPartnerState((previous) => {
      const normalized = normalizePartnerState(previous);
      const cbtStudySessions = upsertStudySession(normalized.cbtStudySessions, snapshot);
      if (cbtStudySessions === normalized.cbtStudySessions) return previous;
      return { ...normalized, cbtStudySessions,
        planVersions: normalized.planVersions.map((plan) => applyDailyCbtProgress(plan, cbtStudySessions)), lastUpdatedAt: Date.now() };
    });
  }

  function recordFinishedSession({ forceCompleteBlock = false } = {}) {
    saveStudyBlockProgress(forceCompleteBlock, true);
    if (!session.submitted || !session.questions.length) return;
    const recordId = `${session.startedAt}:${session.exam?.id || "exam"}`;
    if (recordedSessionIds.current.has(recordId) || [...history, ...practiceHistory, ...pdfQuizHistory].some((row) => row.sessionId === `${session.startedAt}`)) return null;
    recordedSessionIds.current.add(recordId);
    const result = session.result;
    if (result.assessmentType === 'practice' && !result.answered) return null;
    const now = Date.now();
    const scope = resolveStudyScope(session.exam, session.mode);
    const answeredEntries = session.questions
      .map((question, index) => ({ question, index, answer: session.answers[index] }))
      .filter((item) => item.answer !== undefined);
    const wrong = answeredEntries
      .filter(({ question, answer }) => Number(answer) !== Number(question.answerIndex))
      .map(({ question, index, answer }) => ({
        ...question,
        selectedAnswerIndex: answer,
        examTitle: session.exam?.title || "학습",
        examId: session.exam?.id || "",
        certificateId: session.exam?.certificateId || certificate?.id || question.certificateId || "",
        certificateName: session.exam?.certificateName || certificate?.name || question.certificateName || "",
        studyScope: scope,
        learningType: resolveLearningType(session.exam || {}, session.mode, scope),
        attemptId: `${session.startedAt}:${question.id || index}`,
        createdAt: now,
      }));
    const isPdf = session.exam?.sourceType === "pdf";

    recordAnsweredProgress(answeredEntries, scope);

    if (isPdf) {
      const pdfId = session.exam?.pdfId || "";
      const sourceName = session.exam?.sourceName || session.exam?.title || "PDF 학습";
      setPdfQuizHistory((previous) => [{
        sessionId: `${session.startedAt}`,
        title: session.exam?.title || "PDF 이해도 확인",
        examId: session.exam?.id || "",
        pdfId,
        sourceName,
        mode: session.mode,
        score: result.score,
        total: result.total,
        correct: result.correct,
        wrong: result.wrong,
        resultLabel: "학습 완료",
        subjects: result.subjects,
        createdAt: now,
      }, ...previous].slice(0, 300));
      setPdfQuizWrongNotes((previous) => [...wrong.map((question) => ({ ...question, pdfId, sourceName, sourceType: "PDF" })), ...previous].slice(0, 1500));
      setPartnerState((previous) => {
        const normalized = normalizePartnerState(previous);
        const weakSubjects = [...(result.subjects || [])].filter((item) => Number(item.wrong || 0) > 0)
          .sort((a, b) => Number(a.score || 0) - Number(b.score || 0) || Number(b.wrong || 0) - Number(a.wrong || 0))
          .slice(0, 3)
          .map((item) => item.subject)
          .filter(Boolean);
        const signal = {
          id: `pdf-signal-${now}`,
          type: "pdf_quiz",
          goalId: session.exam?.partnerGoalId || '',
          pdfId,
          sourceName,
          score: result.score,
          total: result.total,
          correct: result.correct,
          weakSubjects,
          createdAt: now,
        };
        let next = normalizePartnerState({ ...normalized, learningSignals: [signal, ...normalized.learningSignals].slice(0, 100) });
        next = recordChangeEvent(next, {
          type: "study_result_saved",
          label: `${sourceName} 이해도 확인 ${result.score}점이 저장되었습니다.${signal.goalId ? ' 연결된 내신 목표에 반영합니다.' : ''}`,
          after: { score: result.score, weakSubjects },
          actor: "system",
        });
        const hasAcademicGoal = next.goals.some((goal) => goal.id === signal.goalId);
        if (!hasAcademicGoal || !getActivePartnerPlan(next)) return next;
        const replanned = buildDeterministicPlan(next, { basedOnEventId: next.changeEvents[0]?.id || "", source: "rules" });
        return createPlanVersion(next, replanned, { activate: false });
      });
      return;
    }

    const certificateId = session.exam?.certificateId || certificate?.id || "";
    const certificateName = session.exam?.certificateName || certificate?.name || "";
    const isStudyBlock = Boolean(session.exam?.partnerItemId && session.exam?.studyBlockTargetMinutes);
    const blockProgress = isStudyBlock ? calculateCbtBlockProgress({
      targetMinutes: session.exam.studyBlockTargetMinutes,
      completedMinutes: session.exam.studyBlockCompletedMinutes,
      completedSeconds: session.exam.studyBlockCompletedSeconds,
      elapsedSeconds: session.elapsedSeconds,
      answeredCount: result.answered,
      forceComplete: forceCompleteBlock,
    }) : null;
    const sessionRecord = {
      sessionId: `${session.startedAt}`,
      title: session.exam?.title || "시험",
      examId: session.exam?.id || "",
      certificateId,
      certificateName,
      mode: session.mode,
      assessmentType: result.assessmentType,
      studyScope: scope,
      learningType: resolveLearningType(session.exam || {}, session.mode, scope),
      subject: session.exam?.subject || "",
      topic: session.exam?.topic || "",
      score: result.score,
      total: result.total,
      correct: result.correct,
      wrong: result.wrong,
      answered: result.answered,
      unanswered: result.unanswered,
      passed: result.passed,
      resultLabel: result.resultLabel,
      subjects: result.subjects,
      createdAt: now,
    };

    setPartnerState((previous) => {
      const normalized = normalizePartnerState(previous);
      const activeBefore = getActivePartnerPlan(normalized);
      const completedItem = !isStudyBlock && (activeBefore?.today?.items || []).find((item) => item.id === session.exam?.partnerItemId);
      const itemStatus = blockProgress ? (blockProgress.completed ? "completed" : "in_progress") : "completed";
      const itemResult = blockProgress ? {
        ...(completedItem?.result || {}),
        score: result.score,
        correct: result.correct,
        total: result.total,
        completedMinutes: blockProgress.completedMinutes,
        targetMinutes: blockProgress.targetMinutes,
        remainingMinutes: blockProgress.remainingMinutes,
        completedQuestions: Number(completedItem?.result?.completedQuestions || 0) + result.answered,
        roundCount: Number(completedItem?.result?.roundCount || 0) + 1,
        seenQuestionIds: [...new Set([...(completedItem?.result?.seenQuestionIds || []), ...(session.exam?.studyBlockSeenIds || []), ...session.questions.map(questionProgressId)])].slice(-3000),
        lastStudiedAt: now,
        ...(blockProgress.completed ? { completedAt: now } : {}),
      } : { score: result.score, correct: result.correct, total: result.total, completedAt: now };
      let next = completedItem
        ? updateTodayItemStatus(normalized, completedItem.id, itemStatus, itemResult)
        : normalized;
      if (completedItem) next = recordChangeEvent(next, {
        type: itemStatus === "completed" ? "plan_item_completed" : "study_block_progress",
        label: itemStatus === "completed"
          ? `${completedItem.title} 학습을 완료했습니다.`
          : `${completedItem.title} ${blockProgress.completedMinutes}/${blockProgress.targetMinutes}분을 학습했습니다.`,
        after: { itemId: completedItem.id, goalId: completedItem.goalId, title: completedItem.title, score: result.score, ...blockProgress },
        actor: "student",
      });
      const target = next.certificateGoals.find((item) => item.name === certificateName || item.id === certificateId)
        || next.certificateGoal;
      if (!target?.name) return next;
      const sameTarget = !certificateName || target.name === certificateName || target.id === certificateId;
      if (!sameTarget) return next;
      const weakestSubjects = [...(result.subjects || [])].filter((item) => Number(item.wrong || 0) > 0)
        .sort((a, b) => Number(a.score || 0) - Number(b.score || 0) || Number(b.wrong || 0) - Number(a.wrong || 0))
        .slice(0, 3)
        .map((item) => item.subject)
        .filter(Boolean);
      const updatedTarget = {
          ...target,
          ...(result.assessmentType === 'exam' ? { cbtAccuracy: result.score } : {}),
          lastPracticeScore: result.score,
          weakSubjects: weakestSubjects,
          lastCbtAt: now,
          lastDiagnostic: session.exam?.studyScope === "diagnostic" ? {
            score: result.score,
            total: result.total,
            correct: result.correct,
            weakSubjects: weakestSubjects,
            generated: session.exam?.generationMode === "ai",
            createdAt: now,
          } : target.lastDiagnostic,
      };
      next = normalizePartnerState({
        ...next,
        certificateGoals: next.certificateGoals.map((item) => item.id === target.id ? updatedTarget : item),
      });
      next = recordChangeEvent(next, {
        type: "study_result_saved",
        label: `${target.name} CBT 결과 ${result.score}점이 저장되어 자격증 계획을 다시 확인합니다.`,
        before: { cbtAccuracy: target.cbtAccuracy ?? null },
        after: { cbtAccuracy: result.score },
        actor: "system",
      });
      if (!getActivePartnerPlan(next) || blockProgress) return next;
      const completedPlan = getActivePartnerPlan(next);
      const replanned = transferPlanProgress(completedPlan, buildDeterministicPlan(next, { basedOnEventId: next.changeEvents[0]?.id || "", source: "rules" }));
      return createPlanVersion(next, replanned, { activate: false });
    });

    if (result.assessmentType === "practice") {
      setPracticeHistory((previous) => [sessionRecord, ...previous].slice(0, 500));
    } else {
      setHistory((previous) => [sessionRecord, ...previous].slice(0, 300));
    }
    setWrongNotes((previous) => mergeWrongAttempts(previous, wrong));
    setStudyEvents((previous) => [{
      type: result.assessmentType === "practice" ? "practice" : "exam",
      studyScope: scope,
      learningType: resolveLearningType(session.exam || {}, session.mode, scope),
      examId: session.exam?.id || "",
      certificateId,
      certificateName,
      questionCount: result.total,
      durationSeconds: session.elapsedSeconds,
      createdAt: now,
    }, ...previous].slice(0, 1000));

    const bookmarked = session.questions
      .filter((question, index) => session.bookmarks[index])
      .map((question) => ({
        ...question,
        examId: question.examId || session.exam?.id || "",
        examTitle: question.examTitle || session.exam?.title || "시험",
        certificateId: question.certificateId || session.exam?.certificateId || certificate?.id || "",
        certificateName: question.certificateName || session.exam?.certificateName || certificate?.name || "",
        savedAt: now,
      }));
    if (bookmarked.length) {
      setQuestionBookmarks((previous) => deduplicateQuestions([...bookmarked, ...previous]).questions.slice(0, 1000));
    }
    return blockProgress;
  }

  async function recalculateLearningData(targetCertificateId = "") {
    const targetEvents = filterCertificateAttempts(attemptEvents, targetCertificateId);
    if (!targetEvents.length) {
      return { ok: false, message: "다시 계산할 원본 풀이 기록이 없습니다." };
    }
    const rebuilt = buildMaintenanceResult(targetEvents);
    if (targetCertificateId) {
      const otherProgress = learningProgress.filter((item) => item.certificateId !== targetCertificateId);
      const otherWrong = wrongNotes.filter((item) => item.certificateId !== targetCertificateId);
      const otherAttempts = attemptEvents.filter((item) => item.certificateId !== targetCertificateId);
      setLearningProgress([...rebuilt.learningProgress, ...otherProgress]);
      setWrongNotes([...rebuilt.wrongNotes, ...otherWrong]);
      setAttemptEvents([...rebuilt.attemptEvents, ...otherAttempts]);
    } else {
      setLearningProgress(rebuilt.learningProgress);
      setWrongNotes(rebuilt.wrongNotes);
      setAttemptEvents(rebuilt.attemptEvents);
    }
    if (user?.uid) {
      await replaceCloudLearningProgress(user.uid, rebuilt.learningProgress, targetCertificateId).catch((error) => {
        console.error("Firestore 통계 재계산 동기화 실패", error);
      });
    }
    return { ok: true, message: `${rebuilt.summary.attemptCount}개 원본 풀이 기록으로 통계를 다시 계산했습니다.`, summary: rebuilt.summary };
  }

  async function resetLearningData(targetCertificateId = "") {
    if (!targetCertificateId) await session.clearAllDrafts();
    else if (session.exam?.certificateId === targetCertificateId) session.clearCheckpoint();
    setPartnerState((previous) => {
      const next = normalizePartnerState(previous);
      const affected = new Set(next.cbtStudySessions.filter((s) => !targetCertificateId || s.certificateId === targetCertificateId).map((s) => s.goalId));
      return { ...next, cbtStudySessions: next.cbtStudySessions.filter((s) => targetCertificateId && s.certificateId !== targetCertificateId),
        planVersions: next.planVersions.map((plan) => ({ ...plan, today: { ...plan.today, items: (plan.today?.items || []).map((item) => item.action === 'cbt' && (!targetCertificateId || affected.has(item.goalId)) ? { ...item, result: {}, status: 'todo' } : item) } })) };
    });
    if (targetCertificateId) {
      setAttemptEvents((items) => items.filter((item) => item.certificateId !== targetCertificateId));
      setLearningProgress((items) => items.filter((item) => item.certificateId !== targetCertificateId));
      setWrongNotes((items) => items.filter((item) => item.certificateId !== targetCertificateId));
      setHistory((items) => items.filter((item) => item.certificateId !== targetCertificateId));
      setPracticeHistory((items) => items.filter((item) => item.certificateId !== targetCertificateId));
      setStudyEvents((items) => items.filter((item) => item.certificateId !== targetCertificateId));
      if (user?.uid) await clearCloudLearningData(user.uid, targetCertificateId).catch(console.error);
      return;
    }
    setAttemptEvents([]);
    setLearningProgress([]);
    setWrongNotes([]);
    setHistory([]);
    setPracticeHistory([]);
    setStudyEvents([]);
    if (user?.uid) await clearCloudLearningData(user.uid, "").catch(console.error);
  }

  async function finishExam() {
    if (!session.submitted) await session.flushCheckpoint();
    recordFinishedSession();
    const scope = resolveStudyScope(session.exam, session.mode);
    const fallback = {
      pdf: "pdfstudy",
      subject: "subject",
      all: "all",
      topic: "all",
      "saved-bookmark": "saved",
      recommended: "learning",
      "wrong-review": "bookmark",
      "due-review": "learning",
      search: "search",
      "exam-practice": "past",
      exam: "past",
      mock: "mock",
    }[scope] || "past";
    if (session.submitted) session.clearCheckpoint();
    setPage(session.exam?.returnPage === "topic" ? "all" : (session.exam?.returnPage || fallback));
  }

  function navigate(next) {
    const destination = next === "topic" ? "all" : next;
    if (!['library', 'pdfstudy', 'exam'].includes(destination)) setAcademicGoalContext(null);
    if (!certificate && ["certificate", "past", "subject", "all", "saved", "mock", "bookmark", "search", "planner", "learning", "report"].includes(destination)) {
      setPage("catalog");
      return;
    }
    if (destination === "graph") setGraphQuery("");
    if (destination === "notes") setAssetFocus(null);
    if (destination === "tutor" && page !== "pdfstudy") setTutorSeed({ question: "", pdfId: "" });
    if (destination === "partnerPlan") setPlanFocusGoalId("");
    setPage(destination);
  }

  function removeSavedBookmark(question) {
    setQuestionBookmarks((previous) => removeQuestionFromList(previous, question));
  }

  function updateSavedBookmark(question, bookmarked, exam) {
    const enriched = {
      ...question,
      examId: question.examId || exam?.id || "",
      examTitle: question.examTitle || exam?.title || "시험",
      certificateId: question.certificateId || exam?.certificateId || certificate?.id || "",
      certificateName: question.certificateName || exam?.certificateName || certificate?.name || "",
      savedAt: Date.now(),
    };
    setQuestionBookmarks((previous) => bookmarked
      ? deduplicateQuestions([enriched, ...previous]).questions.slice(0, 1000)
      : removeQuestionFromList(previous, enriched));
  }

  function openPartnerPlan(goalId = "") {
    setPlanFocusGoalId(String(goalId || ""));
    setPage("partnerPlan");
  }

  function partnerCertificateGoal(item) {
    const normalized = normalizePartnerState(partnerState);
    return normalized.certificateGoals.find((goal) => String(goal.id) === String(item?.goalId)) || null;
  }

  function partnerTargetCertificate(item) {
    return findCertificateForGoal(partnerCertificateGoal(item), certificates);
  }

  function showPartnerCbtError(item, message, actionPage = "catalog", actionLabel = "지원 자격증 보기") {
    setPartnerLearningAction({ itemId: item?.id || "", status: "error", message, actionPage, actionLabel });
  }

  function openPartnerCertificateGoal(goalId) {
    const item = { id: `certificate-home:${goalId}`, goalId };
    const goal = partnerCertificateGoal(item);
    const target = findCertificateForGoal(goal, certificates);
    if (!target) {
      showPartnerCbtError(item, certificateUnavailableReason(goal, certificates, { databaseConfigured: firebaseConfigured, catalogLoaded: certificatesLoaded }));
      setPage("partnerToday");
      return;
    }
    selectCertificate(target);
  }

  function startPartnerCertificateGoal(goalId) {
    startPartnerCbtAction({ id: `certificate-shortcut:${goalId}`, goalId, action: "cbt", title: "과년도 기출 이어풀기", durationMinutes: 40 });
  }

  async function loadCertificateQuestionPool(target) {
    const targetExams = certificate?.id === target.id && exams.length ? exams : await listExams(target.id);
    if (!targetExams.length) {
      const error = new Error(`${target.name}는 자격증 DB에 등록되어 있지만 공개된 CBT 기출 회차가 없습니다. 관리자가 시험과 문제를 공개한 뒤 이용할 수 있습니다.`);
      error.actionPage = "catalog";
      error.actionLabel = "지원 자격증 보기";
      throw error;
    }
    const batches = await Promise.all(targetExams.map(async (exam) => ({ exam, questions: await getExamQuestions(exam.id) })));
    const questionPool = batches.flatMap(({ exam, questions }) => (questions || []).map((question) => ({
      ...question,
      sourceExamId: question.sourceExamId || exam.id,
      examId: question.examId || exam.id,
      examTitle: question.examTitle || exam.title,
      examYear: question.examYear || exam.year || "",
      certificateId: target.id || "",
      certificateName: target.name || "",
    })));
    if (questionPool.length < 4) {
      const error = new Error(`${target.name}의 공개 문제는 ${questionPool.length}개뿐이라 이어풀기 세트를 만들 수 없습니다. 최소 4문제가 DB에 등록되어야 합니다.`);
      error.actionPage = "catalog";
      error.actionLabel = "지원 자격증 보기";
      throw error;
    }
    setExams(targetExams);
    return questionPool;
  }

  async function startPartnerCbtAction(item) {
    if (cbtLaunchBusy.current) return;
    if (session.exam?.partnerGoalId === item.goalId && session.resumable
      && session.exam.studyBlockDate === getActivePartnerPlan(partnerState)?.today?.date) { setPage('exam'); return; }
    const linkedGoal = partnerCertificateGoal(item);
    const target = partnerTargetCertificate(item);
    if (!target) {
      if (!linkedGoal) {
        showPartnerCbtError(item, "이 학습 일정에 연결된 자격증 정보를 찾을 수 없습니다. 목표 정보를 확인한 뒤 계획을 다시 계산해 주세요.", "partnerGoals", "목표 일정 확인");
      } else {
        showPartnerCbtError(item, certificateUnavailableReason(linkedGoal, certificates, { databaseConfigured: firebaseConfigured, catalogLoaded: certificatesLoaded }));
      }
      return;
    }
    cbtLaunchBusy.current = true;
    try {
      setPartnerLearningAction({ itemId: item.id, status: "analyzing", message: "미풀이 기출과 최근 오답을 골라 다음 세트를 준비하고 있어요." });
      setCertificate(target);
      setActiveCertificateId(target.id || "");
      const questionPool = await loadCertificateQuestionPool(target);
      const targetProgress = certificate?.id === target.id ? certificateLearningProgress : learningProgress.filter((row) => row.certificateId === target.id);
      const activePlan = getActivePartnerPlan(partnerState);
      const savedItem = (activePlan?.today?.items || []).find((row) => row.id === item.id) || item;
      const targetMinutes = Math.max(15, Number(savedItem.durationMinutes || item.durationMinutes || 40));
      const completedMinutes = Math.max(0, Number(savedItem?.result?.completedMinutes || 0));
      const completedSeconds = Number(savedItem?.result?.completedSeconds ?? completedMinutes * 60);
      const remainingMinutes = Math.max(0, targetMinutes - completedSeconds / 60);
      if (remainingMinutes <= 0 || savedItem.status === 'completed') {
        setPartnerLearningAction({ itemId: item.id, status: 'ready', message: '오늘 목표를 마쳤습니다.' }); return;
      }
      const seenQuestionIds = savedItem?.result?.seenQuestionIds || [];
      const selection = selectContinuousPastQuestions({
        questions: questionPool,
        progress: targetProgress,
        seenQuestionIds,
        recentWrongQuestions: wrongNotes.filter((row) => row.certificateId === target.id).slice(0, 100),
        limit: roundQuestionCount(remainingMinutes, (partnerState.cbtStudySessions || []).filter((s) => s.certificateId === target.id)),
      });
      if (!selection.questions.length) throw new Error('정답·선택지가 유효한 기출문제가 없습니다.');
      const generationNotice = `기출 ${selection.questions.length}문제 · 오답/복습 ${selection.reviewCount} · 같은 유형 ${selection.similarCount} · 미풀이 ${selection.unseenCount} (같은 유형 포함)`;
      const started = session.start({
        id: `continuous-past-${Date.now()}`,
        title: "과년도 기출 이어풀기",
        durationMinutes: Math.min(30, Math.max(10, selection.questions.length * 2)),
        hasSubjectCutoff: false,
        assessmentType: "practice",
        studyScope: "continuous-past",
        learningType: "pastPaperRoutine",
        returnPage: "partnerToday",
        certificateId: target.id || "",
        certificateName: target.name || "",
        partnerItemId: item.id,
        partnerGoalId: item.goalId,
        studyBlockDate: activePlan?.today?.date || new Date().toLocaleDateString('en-CA'),
        generationMode: "past-question-routine",
        generationNotice,
        studyBlockTargetMinutes: targetMinutes,
        studyBlockCompletedMinutes: completedMinutes,
        studyBlockCompletedSeconds: completedSeconds,
        studyBlockSeenIds: seenQuestionIds,
        studyBlockRound: Number(savedItem?.result?.roundCount || 0) + 1,
      }, selection.questions, "연습모드");
      if (!started) { setPartnerLearningAction(null); return; }
      setPartnerLearningAction({ itemId: item.id, status: "ready", message: generationNotice });
      setPage("exam");
    } catch (error) {
      console.error("파트너 CBT 실행 실패:", error);
      showPartnerCbtError(item, error?.message || "맞춤 학습을 시작하지 못했습니다.", error?.actionPage, error?.actionLabel);
    } finally {
      cbtLaunchBusy.current = false;
    }
  }

  async function continuePartnerCbtRound() {
    if (cbtLaunchBusy.current || !session.submitted || !session.exam?.studyBlockTargetMinutes) return;
    cbtLaunchBusy.current = true;
    const answeredCount = session.result.answered;
    const blockProgress = calculateCbtBlockProgress({
      targetMinutes: session.exam.studyBlockTargetMinutes,
      completedMinutes: session.exam.studyBlockCompletedMinutes,
      completedSeconds: session.exam.studyBlockCompletedSeconds,
      elapsedSeconds: session.elapsedSeconds,
      answeredCount,
    });
    recordFinishedSession();
    if (blockProgress.completed || session.exam.studyBlockDate !== getActivePartnerPlan(partnerState)?.today?.date) {
      session.clearCheckpoint();
      setPage("partnerToday");
      cbtLaunchBusy.current = false;
      return;
    }
    const target = certificates.find((item) => item.id === session.exam.certificateId) || certificate;
    if (!target) { cbtLaunchBusy.current = false; return; }
    try {
      setPartnerLearningAction({ itemId: session.exam.partnerItemId, status: "analyzing", message: "방금 틀린 문제와 같은 유형을 다음 기출에서 찾고 있어요." });
      const questionPool = await loadCertificateQuestionPool(target);
      const wrongThisRound = session.questions.filter((question, index) => session.answers[index] !== undefined && Number(session.answers[index]) !== Number(question.answerIndex));
      const answeredQuestions = session.questions.filter((q,i) => session.answers[i] !== undefined);
      const seenQuestionIds = [...new Set([...(session.exam.studyBlockSeenIds || []), ...answeredQuestions.map(questionProgressId)])];
      const targetProgress = session.questions.reduce((rows, question, index) => session.answers[index] === undefined ? rows : mergeLearningProgress(rows, {
        question, exam: session.exam, mode: session.mode, selectedAnswerIndex: session.answers[index],
        isCorrect: Number(session.answers[index]) === Number(question.answerIndex), attemptId: `${session.startedAt}:${question.id || index}`,
      }), learningProgress.filter((row) => row.certificateId === target.id));
      const selection = selectContinuousPastQuestions({
        questions: questionPool,
        progress: targetProgress,
        seenQuestionIds,
        recentWrongQuestions: [...wrongThisRound, ...wrongNotes.filter((row) => row.certificateId === target.id).slice(0, 100)],
        limit: roundQuestionCount(blockProgress.remainingMinutes, [...(partnerState.cbtStudySessions || []).filter((s) => s.certificateId === target.id), { answered: answeredCount, durationSeconds: session.elapsedSeconds }]),
      });
      if (!selection.questions.length) throw new Error('정답·선택지가 유효한 기출문제가 없습니다.');
      const generationNotice = `남은 목표 ${blockProgress.remainingMinutes}분 · 미풀이 ${selection.unseenCount}문제와 방금 오답에 가까운 유형을 우선 배치했습니다.`;
      session.clearCheckpoint();
      session.start({
        ...session.exam,
        id: `continuous-past-${Date.now()}`,
        title: "과년도 기출 이어풀기",
        studyBlockCompletedMinutes: blockProgress.completedMinutes,
        studyBlockCompletedSeconds: blockProgress.completedSeconds,
        studyBlockSeenIds: seenQuestionIds,
        studyBlockRound: Number(session.exam.studyBlockRound || 1) + 1,
        generationNotice,
      }, selection.questions, "연습모드");
      setPartnerLearningAction({ itemId: session.exam.partnerItemId, status: "ready", message: generationNotice });
      window.scrollTo(0, 0);
    } catch (error) {
      console.error("다음 기출 세트 구성 실패:", error);
      showPartnerCbtError({ id: session.exam.partnerItemId }, error?.message || "다음 기출 세트를 준비하지 못했습니다.");
      setPage("partnerToday");
    } finally {
      cbtLaunchBusy.current = false;
    }
  }

  function finishPartnerCbtBlock() {
    recordFinishedSession({ forceCompleteBlock: true });
    session.clearCheckpoint();
    setPage("partnerToday");
  }

  function navigatePartnerAction(item) {
    if (item?.action === "cbt") {
      startPartnerCbtAction(item);
      return;
    }
    if (item?.action === 'academic') setAcademicGoalContext({ goalId: item.goalId, title: normalizePartnerState(partnerState).goals.find((goal) => goal.id === item.goalId)?.title || '' });
    const targets = { academic: "library", career: "career", activity: "projects", plan: "partnerPlan", goals: "partnerGoals" };
    navigate(targets[item?.action] || "partnerToday");
  }

  function createBuildProject(invent) {
    const exists = buildProjects.find((item) => item.sourceInventId === invent.id);
    if (exists) { setPage("projects"); return; }
    const now = Date.now();
    const project = makeBuildProject({
      sourceInventId: invent.id,
      title: invent.rightsDraft?.title || invent.title,
      problem: invent.rightsDraft?.problem || invent.problem?.inconvenience || "",
      solution: invent.solution?.concept || "",
      status: "active",
      tasks: [
        { id: `task-${now}-1`, title: "요구사항과 성공 기준 정리", done: false },
        { id: `task-${now}-2`, title: "핵심 기능 또는 구조 프로토타입 제작", done: false },
        { id: `task-${now}-3`, title: "사용자 테스트 및 개선점 기록", done: false },
        { id: `task-${now}-4`, title: "발표 자료와 결과 보고서 정리", done: false },
      ],
      journals: [],
    });
    setBuildProjects([project, ...buildProjects]);
    setPage("projects");
  }

  async function allQuestionBatches() {
    return Promise.all(exams.map(async (exam) => ({ exam, questions: await getExamQuestions(exam.id) })));
  }

  async function searchQuestions(keyword) {
    const term = keyword.toLowerCase();
    const batches = await allQuestionBatches();
    return batches
      .flatMap((batch) => batch.questions.map((question) => ({ exam: batch.exam, q: question })))
      .filter(({ q }) => [q.question, ...(q.choices || []), q.explanation, q.subject, q.topic, q.chapter, q.unit, ...(q.tags || [])].join(" ").toLowerCase().includes(term))
      .slice(0, 150);
  }

  function openSearchResult(exam, question) {
    const pseudo = {
      ...(exam || {}),
      id: `search-${question.id}`,
      title: `검색 학습 · ${question.subject || "문제"}`,
      durationMinutes: 5,
      hasSubjectCutoff: false,
      assessmentType: "practice",
      studyScope: "search",
      learningType: "examPractice",
      returnPage: "search",
    };
    session.start(pseudo, [question], "연습모드");
    setPage("exam");
  }

  function startWrongReview(items) {
    const questions = (items || []).map((item, index) => (
      item?.questionId && item?.correctAnswerIndex !== undefined
        ? progressToQuestion(item, index)
        : { ...item, questionNumber: index + 1 }
    ));
    if (!questions.length) return;
    session.start({
      id: `wrong-review-${Date.now()}`,
      title: "CBT 반복 오답 집중복습",
      durationMinutes: questions.length,
      hasSubjectCutoff: false,
      assessmentType: "practice",
      studyScope: "wrong-review",
      learningType: "repeatedWrong",
      returnPage: "bookmark",
      certificateId: certificate?.id || "",
      certificateName: certificate?.name || "",
    }, questions, "연습모드");
    setPage("exam");
  }

  function startDueReview(items) {
    const questions = (items || []).map(progressToQuestion).filter((question) => question.choices.length && Number.isInteger(question.answerIndex));
    if (!questions.length) { notifyUser("복습 가능한 문제 원문이 없습니다. 새 버전에서 푼 문제부터 복습할 수 있습니다.", "error"); return; }
    session.start({
      id: `due-review-${Date.now()}`,
      title: "오늘의 자동 복습",
      durationMinutes: questions.length,
      hasSubjectCutoff: false,
      assessmentType: "practice",
      studyScope: "due-review",
      learningType: "srsReview",
      returnPage: "learning",
      certificateId: certificate?.id || "",
      certificateName: certificate?.name || "",
    }, questions, "연습모드");
    setPage("exam");
  }

  async function startRecommended(subjectOrTag, count = 20) {
    const batches = await allQuestionBatches();
    const term = String(subjectOrTag || "전체 과목").trim();
    const pool = batches.flatMap((batch) => batch.questions).filter((question) => {
      if (term === "전체 과목") return true;
      return question.subject === term || getQuestionTags(question).includes(term);
    });
    if (!pool.length) { notifyUser("추천 문제를 만들 수 있는 기출문제가 없습니다.", "error"); return; }
    const questions = shuffle(pool).slice(0, Math.min(count, pool.length)).map((question, index) => ({ ...question, questionNumber: index + 1 }));
    session.start({
      id: `recommended-${Date.now()}`,
      title: `AI 추천 · ${term}`,
      durationMinutes: questions.length,
      hasSubjectCutoff: false,
      assessmentType: "practice",
      studyScope: "recommended",
      learningType: "dailyRecommended",
      returnPage: "learning",
      certificateId: certificate?.id || "",
      certificateName: certificate?.name || "",
    }, questions, "연습모드");
    setPage("exam");
  }

  function openPdf(document, pageNumber = 1) {
    if (document) localStorage.setItem("studylock-open-pdf", JSON.stringify({ id: document.id, page: pageNumber }));
    else localStorage.removeItem("studylock-open-pdf");
    setPage("pdfstudy");
  }

  function startPdfQuiz(questions, meta) {
    const normalized = (questions || []).map((question, index) => ({
      ...question,
      id: question.id || `pdf-q-${Date.now()}-${index}`,
      questionNumber: question.questionNumber || index + 1,
      subject: question.subject || "PDF 이해도 확인",
      sourceName: meta?.name || "PDF",
      sourceType: "PDF",
      pdfId: meta?.pdfId || "",
    }));
    if (!normalized.length) return;
    const started = session.start({
      id: `pdf-${Date.now()}`,
      title: `${meta?.name || "PDF"} · 이해도 확인`,
      durationMinutes: normalized.length,
      hasSubjectCutoff: false,
      assessmentType: "practice",
      studyScope: "pdf",
      learningType: "pdfPractice",
      sourceType: "pdf",
      partnerGoalId: academicGoalContext?.goalId || '',
      pdfId: meta?.pdfId || "",
      sourceName: meta?.name || "PDF",
      returnPage: "pdfstudy",
      teacherProfile: meta?.teacherProfile || null,
      qualityReport: meta?.qualityReport || null,
      requestedQuestionCount: Number(meta?.requestedCount || normalized.length),
      generationMode: "ai",
      generationNotice: `${academicGoalContext?.title ? `${academicGoalContext.title}에 결과 반영 · ` : ''}${meta?.generationNotice || "PDF 근거와 AI 자동검수를 통과한 문항입니다."}`,
    }, normalized, "연습모드");
    if (!started) return;
    setPage("exam");
  }

  function openTutorWithPdf(name) {
    const document = pdfLibrary.find((item) => String(item.name || "").replace(/\.pdf$/i, "").trim() === String(name || "").replace(/\.pdf$/i, "").trim())
      || pdfLibrary.find((item) => item.name === name);
    setTutorSeed({ question: "", pdfId: document?.id || "" });
    setPage("tutor");
  }

  async function createAssetsFromPdf(document) {
    if (!document?.pages?.length) { notifyUser("이 PDF는 텍스트가 저장되지 않아 AI 자료를 만들 수 없습니다. PDF를 다시 업로드해 주세요.", "error"); return; }
    setAssetBusy(true);
    try {
      const created = await generateStudyAssetsFromPages({ pages: document.pages, sourceName: document.name, pdfId: document.id });
      const same = (item) => item.pdfId === document.id || String(item.sourceName || "").replace(/\.pdf$/i, "").trim().toLowerCase() === String(document.name || "").replace(/\.pdf$/i, "").trim().toLowerCase();
      const next = {
        notes: [...created.notes, ...(assets.notes || []).filter((item) => !same(item))],
        cards: [...created.cards, ...(assets.cards || []).filter((item) => !same(item))],
      };
      saveStudyAssets(next);
      setAssets(next);
      setPage("notes");
    } catch (error) {
      notifyUser(error.message, "error");
    } finally {
      setAssetBusy(false);
    }
  }

  async function createAssetsFromWrong() {
    if (!wrongNotes.length) { notifyUser("CBT 오답이 없습니다."); return; }
    setAssetBusy(true);
    try {
      const source = wrongNotes.slice(0, 40).map((question, index) => `${index + 1}. [${question.subject || "공통"}] ${question.question}\n정답: ${(question.choices || [])[question.answerIndex] || question.answerIndex}\n해설: ${question.explanation || ""}`).join("\n\n").slice(0, 18000);
      const body = await postJson(
        "/api/generate-study-assets",
        { source, sourceName: `${certificate?.name || "자격증"} CBT 오답` },
        "CBT 오답 학습자료 생성에 실패했습니다.",
      );
      const sourceName = `${certificate?.name || "자격증"} CBT 오답`;
      const next = {
        notes: [...(body.notes || []).map((note) => ({ ...note, id: assetId("note"), sourceName, sourceType: "CBT 오답", folderId: `cbt:${certificate?.id || "general"}`, certificateId: certificate?.id || "", certificateName: certificate?.name || "자격증", createdAt: Date.now() })), ...(assets.notes || [])],
        cards: [...(body.cards || []).map((card) => ({ ...card, id: assetId("card"), sourceName, sourceType: "CBT 오답", folderId: `cbt:${certificate?.id || "general"}`, certificateId: certificate?.id || "", certificateName: certificate?.name || "자격증", createdAt: Date.now() })), ...(assets.cards || [])],
      };
      saveStudyAssets(next);
      setAssets(next);
    } catch (error) {
      notifyUser(error.message, "error");
    } finally {
      setAssetBusy(false);
    }
  }

  function deleteAsset(type, id) {
    const next = { ...assets, [type]: (assets[type] || []).filter((item) => item.id !== id) };
    saveStudyAssets(next);
    setAssets(next);
  }

  function updateAsset(type, id, patch) {
    const next = { ...assets, [type]: (assets[type] || []).map((item) => item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item) };
    saveStudyAssets(next);
    setAssets(next);
  }

  function deleteAssetFolder(root, folderKey, folderLabel) {
    if (root !== "PDF" || !folderKey || folderKey === "전체") return;
    const normalized = String(folderLabel || "").replace(/\.pdf$/i, "").trim().toLowerCase();
    const matches = (item) => {
      if (!String(item.sourceType || "").toLowerCase().includes("pdf")) return false;
      if (item.folderId) return item.folderId === folderKey;
      if (item.pdfId) return `pdf:${item.pdfId}` === folderKey;
      return String(item.sourceName || "").replace(/\.pdf$/i, "").trim().toLowerCase() === normalized;
    };
    const next = {
      notes: (assets.notes || []).filter((item) => !matches(item)),
      cards: (assets.cards || []).filter((item) => !matches(item)),
    };
    saveStudyAssets(next);
    setAssets(next);
  }

  function openStudyAsset(type, item) {
    if (!item?.id) return;
    setAssetFocus({ type, id: item.id, openedAt: Date.now() });
    setPage("notes");
  }

  async function generatePartnerPlan(
    trigger = { type: "manual", label: "학생이 계획 갱신을 요청했습니다." },
    { destination = "" } = {},
  ) {
    setPartnerBusy(true);
    try {
      const baseState = trigger?.type && trigger.type !== "manual"
        ? recordChangeEvent(partnerState, trigger)
        : normalizePartnerState(partnerState);
      const latestEvent = baseState.changeEvents?.[0];
      const fallbackPlan = {
        ...buildDeterministicPlan(baseState, { basedOnEventId: latestEvent?.id || "", source: "rules" }),
        generation: {
          method: "rules",
          label: "규칙 기반 안전 계획",
          message: "입력한 날짜·가능 시간·고정 일정을 계산해 만든 계획입니다.",
        },
      };
      let finalPlan = fallbackPlan;
      try {
        const response = await postJson(
            "/api/partner/plan",
            {
              snapshot: profileSnapshot(baseState),
              currentPlan: getActivePartnerPlan(baseState),
              fallbackPlan,
              trigger: latestEvent || trigger,
            },
            "AI 계획 생성에 실패했습니다.",
          );
        finalPlan = {
          ...mergeAiPlan(response?.plan, fallbackPlan, baseState),
          generation: {
            method: "ai-assisted",
            label: "AI 보정 계획",
            message: "안전 계산 계획을 유지하면서 AI가 우선순위와 설명을 다듬었습니다.",
            model: String(response?.model || ""),
          },
        };
      } catch (error) {
        console.warn("[MakerOS AI Partner] AI 계획 생성 실패, 규칙 기반 계획 사용:", error.message);
        finalPlan = {
          ...fallbackPlan,
          generation: {
            ...fallbackPlan.generation,
            message: "AI 연결이 지연되어 입력 정보만으로 안전하게 계산한 계획을 사용했습니다.",
          },
        };
      }
      setPartnerState((previous) => {
        const latest = normalizePartnerState(previous);
        const inputsChanged = JSON.stringify(profileSnapshot(latest)) !== JSON.stringify(profileSnapshot(baseState));
        const currentPlan = inputsChanged ? buildDeterministicPlan(latest, { source: 'rules' }) : finalPlan;
        return createPlanVersion(latest, currentPlan, { activate: !getActivePartnerPlan(latest) });
      });
      if (destination) setPage(destination);
    } finally {
      setPartnerBusy(false);
    }
  }

  function confirmPartnerPlan() {
    setPartnerState((previous) => rolloverPartnerDay(confirmPendingPlan(previous)));
  }

  function discardPendingPartnerPlan() {
    setPartnerState((previous) => {
      const normalized = normalizePartnerState(previous);
      const pendingId = normalized.pendingPlanVersionId;
      return {
        ...normalized,
        pendingPlanVersionId: "",
        planVersions: normalized.planVersions.map((item) => item.versionId === pendingId ? { ...item, status: "discarded" } : item),
        lastUpdatedAt: Date.now(),
      };
    });
  }

  function rollbackPartnerVersion(versionId) {
    setPartnerState((previous) => rollbackPartnerPlan(previous, versionId));
  }

  function exportMyData() {
    const exportedAt = new Date().toISOString();
    const payload = {
      schema: "makeros-user-export-v1",
      exportedAt,
      learning: { history, practiceHistory, wrongNotes, learningProgress, studyEvents, attemptEvents, plan, questionBookmarks, pdfQuizHistory, pdfQuizWrongNotes },
      planning: normalizePartnerState(partnerState),
      school: { pdfLibrary, studyAssets: assets },
      growth: { inventorProjects, buildProjects, portfolioItems, awards, certifications, resumeProfile, careerProfile, opportunityBookmarks },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `makeros-data-${exportedAt.slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function resetPartnerPlan() {
    setPartnerState(createDefaultPartnerState());
  }

  async function deleteAccountAndData() {
    if (!user?.uid) throw new Error("계정 삭제는 로그인 후 사용할 수 있습니다.");
    await session.clearAllDrafts();
    await deleteMyAccountAndData(user.uid);
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index) || "";
      if (key.startsWith("makeros:") || key.startsWith("studylock-")) localStorage.removeItem(key);
    }
    setHistory([]); setPracticeHistory([]); setWrongNotes([]); setLearningProgress([]); setStudyEvents([]); setAttemptEvents([]);
    setQuestionBookmarks([]); setPdfQuizHistory([]); setPdfQuizWrongNotes([]); setPdfLibrary([]); setAssets({ notes: [], cards: [] });
    setPartnerState(createDefaultPartnerState());
  }

  function changeTodayPartnerItem(itemId, status) {
    setPartnerState((previous) => {
      const item = (getActivePartnerPlan(previous)?.today?.items || []).find((candidate) => candidate.id === itemId);
      let next = updateTodayItemStatus(previous, itemId, status);
      if (status !== "completed") return next;
      next = recordChangeEvent(next, { type: "plan_item_completed", label: item ? `${item.title}을 완료했습니다.` : "오늘 계획의 행동을 완료했습니다.", after: item ? { itemId, goalId: item.goalId, title: item.title } : { itemId }, actor: "student" });
      return next;
    });
  }

  function adjustTodayPartnerItem(itemId, action) {
    const labels = { reduce: "학습 분량을 15분 줄였습니다.", defer: "이 일을 내일로 옮기고 다음 할 일을 채웠습니다.", skip: "오늘은 건너뛰고 다음 할 일을 채웠습니다." };
    setPartnerState((previous) => recordChangeEvent(
      adjustTodayPlanItem(previous, itemId, action),
      { type: "plan_item_adjusted", label: labels[action] || "오늘 계획을 조정했습니다.", actor: "student" },
    ));
  }

  function toggleTodayDayOff(dayOff) {
    setPartnerState((previous) => setPartnerDayOff(previous, new Date(), dayOff));
  }

  const repeatedWrong = useMemo(() => buildRepeatedWrong(certificateLearningProgress), [certificateLearningProgress]);
  const dueReviews = useMemo(() => getDueReviews(certificateLearningProgress), [certificateLearningProgress]);

  return (
    <div className="app">
      <AppHeader active={active} onNavigate={navigate} certificateName={certificate?.name} certificateShortcuts={certificateShortcuts} onOpenCertificateGoal={openPartnerCertificateGoal} onStartCertificateGoal={startPartnerCertificateGoal} user={user} onLogin={() => setShowAuth(true)} onTutorial={() => setShowTutorial(true)} isAdmin={isAdminUser(user)} syncStatus={syncStatus} />
      <PageErrorBoundary key={page}><Suspense fallback={<main className="loading-page"><div className="empty-state">화면을 불러오고 있습니다…</div></main>}>
      {page === "partnerToday" && <PartnerTodayPage state={partnerState} activeSession={certificateActiveSession} onResumeSession={() => setPage("exam")} onNavigate={navigate} onQuickAction={navigatePartnerAction} onOpenPlanItem={openPartnerPlan} learningAction={partnerLearningAction} onToggleItem={changeTodayPartnerItem} onAdjustItem={adjustTodayPartnerItem} onToggleDayOff={toggleTodayDayOff} onGeneratePlan={() => getActivePartnerPlan(partnerState) ? generatePartnerPlan({ type: "profile_updated", label: "최신 학생 정보로 계획을 다시 계산했습니다." }) : setPage("partnerGoals")} onConfirmPending={confirmPartnerPlan} busy={partnerBusy} />}
      {page === "partnerPlan" && <PartnerPlanPage state={partnerState} focusGoalId={planFocusGoalId} onGeneratePlan={() => getActivePartnerPlan(partnerState) ? generatePartnerPlan({ type: "profile_updated", label: "최신 학생 정보로 계획을 다시 계산했습니다." }) : setPage("partnerGoals")} onConfirmPending={confirmPartnerPlan} onDiscardPending={discardPendingPartnerPlan} onRollback={rollbackPartnerVersion} busy={partnerBusy} />}
      {page === "partnerCalendar" && <PartnerCalendarPage state={partnerState} onChange={setPartnerState} onNavigate={navigate} />}
      {page === "timetable" && <TimetablePage state={partnerState} onChange={setPartnerState} onNavigate={navigate} />}
      {page === "meals" && <MealPage state={partnerState} onNavigate={navigate} />}
      {page === "partnerGoals" && <PartnerGoalsPage value={partnerState} onChange={setPartnerState} onGeneratePlan={() => generatePartnerPlan({ type: "profile_updated", label: "학생 정보가 변경되어 가능한 시간에 맞춘 계획을 적용했습니다." }, { destination: "partnerToday" })} busy={partnerBusy} />}
      {page === "data" && <DataManagementPage user={user} syncStatus={syncStatus} counts={{ exams: history.length + practiceHistory.length, wrongNotes: wrongNotes.length, bookmarks: questionBookmarks.length, pdfs: pdfLibrary.length, plans: normalizePartnerState(partnerState).planVersions.length, drafts: session.drafts.length }} onExport={exportMyData} onResetLearning={() => resetLearningData("")} onResetPlan={resetPartnerPlan} onDeleteAccount={deleteAccountAndData} />}
      {page === "makerHome" && <MakerHomePage onNavigate={navigate} history={history} wrongNotes={wrongNotes} pdfLibrary={pdfLibrary} assets={assets} inventorProjects={inventorProjects} buildProjects={buildProjects} />}
      {page === "invent" && <InventPage projects={inventorProjects} onChangeProjects={setInventorProjects} onCreateBuildProject={createBuildProject} />}
      {page === "projects" && <ProjectsPage projects={buildProjects} inventorProjects={inventorProjects} onChangeProjects={setBuildProjects} onOpenInvent={() => setPage("invent")} />}
      {page === "portfolio" && <PortfolioPage inventorProjects={inventorProjects} buildProjects={buildProjects} history={history} assets={assets} resumeProfile={resumeProfile} onChangeResumeProfile={setResumeProfile} awards={awards} onChangeAwards={setAwards} certifications={certifications} onChangeCertifications={setCertifications} portfolioItems={portfolioItems} onChangePortfolioItems={setPortfolioItems} onNavigate={navigate} />}
      {page === "opportunities" && <OpportunitiesPage portfolioItems={portfolioItems} onChangePortfolioItems={setPortfolioItems} savedIds={opportunityBookmarks} onChangeSavedIds={setOpportunityBookmarks} onAddGoal={(item) => setPartnerState((previous) => { const current = normalizePartnerState(previous); const id = `activity-${Date.now()}`; const deadline = item.deadline === "상시" ? "" : (item.deadline || ""); const activity = { id, title: item.title, deadline, role: "", sourceUrl: item.url, source: item.source }; return { ...current, activities: [activity, ...current.activities], goals: [{ id, type: "activity", title: item.title, deadline, details: `${item.source || "공개 공고"} · ${item.audienceEvidence || "참가 대상 원문 확인"}` }, ...current.goals], lastUpdatedAt: Date.now() }; })} />}
      {page === "career" && <CareerPage assets={assets} inventorProjects={inventorProjects} buildProjects={buildProjects} pdfLibrary={pdfLibrary} history={history} awards={awards} certifications={certifications} portfolioItems={portfolioItems} careerProfile={careerProfile} onChangeCareerProfile={setCareerProfile} onNavigate={navigate} />}
      {page === "catalog" && <CatalogPage certificates={certificates} onSelect={selectCertificate} history={history} wrongNotes={wrongNotes} pdfLibrary={pdfLibrary} onNavigate={navigate} />}
      {page === "certificate" && <CertificateHomePage certificate={certificate} exams={exams} history={certificateHistory} practiceHistory={certificatePracticeHistory} activeSession={certificateActiveSession} wrongNotes={certificateWrongNotes} learningProgress={certificateLearningProgress} plan={plan} pdfLibrary={pdfLibrary} loadQuestions={getExamQuestions} onNavigate={navigate} onOpenExam={openExam} onResumeSession={() => setPage("exam")} onStartRecommended={startRecommended} />}
      {page === "learning" && <LearningCenterPage certificate={certificate} history={certificateHistory} practiceHistory={certificatePracticeHistory} wrongNotes={certificateWrongNotes} learningProgress={certificateLearningProgress} plan={plan} pdfLibrary={pdfLibrary} exams={exams} loadQuestions={getExamQuestions} onStartRecommended={startRecommended} onStartDueReview={startDueReview} onStartRepeatedWrong={startWrongReview} onNavigate={navigate} />}
      {page === "knowledge" && <UnifiedSearchPage searchCbt={searchQuestions} pdfLibrary={pdfLibrary} wrongNotes={[...wrongNotes, ...pdfWrongNotes]} bookmarks={savedBookmarks} notes={assets.notes} cards={assets.cards} onOpenCbt={openSearchResult} onOpenPdf={openPdf} onNavigate={navigate} />}
      {page === "library" && <PdfLibraryPage library={pdfLibrary} onRefresh={() => setPdfLibrary(readPdfLibrary())} onOpen={openPdf} onCreateAssets={createAssetsFromPdf} />}
      {page === "pdfstudy" && <PdfStudyPage library={pdfLibrary} onRefresh={() => setPdfLibrary(readPdfLibrary())} onStartQuiz={startPdfQuiz} onOpenTutor={openTutorWithPdf} />}
      {page === "notes" && <NotesCardsPage assets={assets} onDelete={deleteAsset} onUpdate={updateAsset} onDeleteFolder={deleteAssetFolder} onGenerateFromWrong={createAssetsFromWrong} busy={assetBusy} initialFocus={assetFocus} />}
      {page === "report" && <GrowthReportPage certificate={certificate} history={certificateHistory} practiceHistory={certificatePracticeHistory} studyEvents={certificateStudyEvents} wrongNotes={certificateWrongNotes} learningProgress={certificateLearningProgress} />}
      {page === "tutor" && <AiTutorPage certificate={certificate} initialQuery={tutorSeed.question} initialPdfId={tutorSeed.pdfId} wrongNotes={wrongNotes} pdfLibrary={pdfLibrary} assets={assets} userKey={user?.uid || "guest"} searchCbt={searchQuestions} onOpenCbt={openSearchResult} onOpenPdf={openPdf} onOpenGraph={(query) => { setGraphQuery(query); setPage("graph"); }} />}
      {page === "graph" && <KnowledgeGraphPage initialQuery={graphQuery} wrongNotes={wrongNotes} pdfLibrary={pdfLibrary} assets={assets} searchCbt={searchQuestions} onOpenCbt={openSearchResult} onOpenPdf={openPdf} onOpenAsset={openStudyAsset} onAskTutor={(payload) => { const value = typeof payload === "string" ? { question: payload, pdfId: "" } : payload || { question: "", pdfId: "" }; setTutorSeed(value); setPage("tutor"); }} />}
      {page === "past" && <PastExamsPage exams={exams} loadQuestions={getExamQuestions} resumeSessions={certificateDraftSessions} onResume={resumeExamDraft} onOpen={openExam} onNavigate={navigate} />}
      {page === "subject" && <SubjectStudyPage certificate={certificate} exams={exams} history={certificatePracticeHistory.filter((item) => item.studyScope === "subject")} loadQuestions={getExamQuestions} onStart={(questions, exam) => { session.start({ ...exam, assessmentType: "practice", studyScope: "subject", learningType: "subjectPractice", returnPage: "subject" }, questions, "연습모드"); setPage("exam"); }} onNavigate={navigate} />}
      {page === "all" && <AllQuestionsPage certificate={certificate} exams={exams} loadQuestions={getExamQuestions} resumeSession={session.resumable && session.exam?.studyScope === "all" && (!certificate?.id || session.exam?.certificateId === certificate.id) ? { title: session.exam?.title || "전체 문제 학습", current: session.current, total: session.questions.length, answered: Object.keys(session.answers).length } : null} onResume={() => setPage("exam")} onStart={(questions, exam) => { session.start({ ...exam, assessmentType: "practice", studyScope: "all", learningType: "allPractice", returnPage: "all" }, questions, "연습모드"); setPage("exam"); }} onNavigate={navigate} />}
      {page === "mode" && <ModeSelectPage exam={selectedExam} onStart={startExam} onBack={() => setPage("past")} busy={examStartBusy} error={examStartError} />}
      {page === "exam" && (session.restoring ? <main className="loading-page"><div className="empty-state">저장된 학습 진행 상태를 불러오고 있습니다…</div></main> : <ExamPage session={session} onExit={finishExam} onContinueStudyBlock={continuePartnerCbtRound} onFinishStudyBlock={finishPartnerCbtBlock} onSaveConfidence={saveConfidenceRecord} onBookmarkChange={updateSavedBookmark} isQuestionBookmarked={(question) => savedBookmarkKeys.has(questionContentKey(question))} getDifficulty={getDifficulty} onOpenPdfSource={(pdfId, pageNumber) => { const document = pdfLibrary.find((item) => item.id === pdfId); if (document) openPdf(document, pageNumber); }} />)}
      {page === "mock" && <MockExamPage exams={exams} loadQuestions={getExamQuestions} onStart={(questions, exam) => { session.start({ ...exam, assessmentType: "exam", studyScope: "mock", learningType: "mock", returnPage: "mock", certificateId: certificate?.id || "", certificateName: certificate?.name || "" }, questions, "실전모드"); setPage("exam"); }} />}
      {page === "bookmark" && <BookmarkPage wrongNotes={certificateWrongNotes} certificateName={certificate?.name} history={certificateHistory} onStartRecommended={startRecommended} onStartWrongReview={startWrongReview} repeatedWrong={repeatedWrong} dueReviews={dueReviews} onStartDueReview={startDueReview} />}
      {page === "saved" && <SavedBookmarksPage certificate={certificate} bookmarks={certificateBookmarks} onStart={(questions, exam) => { session.start({ ...exam, assessmentType: "practice", studyScope: "saved-bookmark", learningType: "bookmarkPractice", returnPage: "saved" }, questions, "연습모드"); setPage("exam"); }} onRemove={removeSavedBookmark} onNavigate={navigate} />}
      {page === "search" && <SearchPage exams={exams} searchQuestions={async (term) => (await searchQuestions(term)).map((item) => item.q)} onOpenResult={(exam, question) => openSearchResult(exam, question)} />}
      {page === "planner" && <PlannerPage certificate={certificate} wrongNotes={certificateWrongNotes} history={certificateHistory} practiceHistory={certificatePracticeHistory} learningProgress={certificateLearningProgress} exams={exams} plan={plan} onSavePlan={setPlan} onStartRecommended={startRecommended} onStartDueReview={startDueReview} onStartRepeatedWrong={startWrongReview} pdfLibrary={pdfLibrary} />}
      {page === "admin" && isAdminUser(user) && <AdminPage />}
      </Suspense></PageErrorBoundary>
      {showAuth && <AuthModal user={user} onClose={() => setShowAuth(false)} />}
      <TutorialModal open={showTutorial} onClose={() => setShowTutorial(false)}/>
      <FeedbackCenter />
      <div className="sync-indicator">{assetBusy ? "AI 자료 생성 중…" : syncStatus === "error" ? "저장 상태를 확인해 주세요" : syncStatus === "synced" ? "계정에 저장됨" : user ? "동기화 중…" : "이 기기에 자동 저장"}</div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
