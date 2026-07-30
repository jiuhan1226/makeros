import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  auth,
  firebaseConfigured,
  getExamQuestions,
  isAdminUser,
  listCertificates,
  listExams,
  loadCloudState,
  listUserAttemptEvents,
  onAuthStateChanged,
  saveCloudState,
  saveQuestionProgress,
  replaceCloudLearningProgress,
  clearCloudLearningData,
} from "./firebase";
import AppHeader from "./components/AppHeader";
import AuthModal from "./components/AuthModal";
import CatalogPage from "./pages/CatalogPage";
import CertificateHomePage from "./pages/CertificateHomePage";
import PastExamsPage from "./pages/PastExamsPage";
import ModeSelectPage from "./pages/ModeSelectPage";
import ExamPage from "./pages/ExamPage";
import MockExamPage from "./pages/MockExamPage";
import BookmarkPage from "./pages/BookmarkPage";
import AdminPage from "./pages/AdminPage";
import StudyStatsPage from "./pages/StudyStatsPage";
import SearchPage from "./pages/SearchPage";
import PlannerPage from "./pages/PlannerPage";
import LearningCenterPage from "./pages/LearningCenterPage";
import TopicStudyPage from "./pages/TopicStudyPage";
import SubjectStudyPage from "./pages/SubjectStudyPage";
import UnifiedSearchPage from "./pages/UnifiedSearchPage";
import PdfLibraryPage from "./pages/PdfLibraryPage";
import PdfStudyPage from "./pages/PdfStudyPage";
import NotesCardsPage from "./pages/NotesCardsPage";
import GrowthReportPage from "./pages/GrowthReportPage";
import AiTutorPage from "./pages/AiTutorPage";
import KnowledgeGraphPage from "./pages/KnowledgeGraphPage";
import MakerHomePage from "./pages/MakerHomePage";
import InventPage from "./pages/InventPage";
import ProjectsPage from "./pages/ProjectsPage";
import PortfolioPage from "./pages/PortfolioPage";
import CareerPage from "./pages/CareerPage";
import { shuffle } from "./utils/exam";
import { useExamSession } from "./hooks/useExamSession";
import { assetId, readPdfLibrary, readStudyAssets, saveStudyAssets } from "./utils/studyPlatform";
import { createBuildProject as makeBuildProject, readMakerState, saveMakerState } from "./utils/makerPlatform";
import { generateStudyAssetsFromPages } from "./utils/aiStudyAssets";
import { postJson } from "./utils/api";
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
import "./styles.css";

const LOCAL_KEY = "studylock-v3-state";
const LEGACY_PDF_KEY = "studylock-v1.5-state";

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}"); }
  catch { return {}; }
}

function readLegacyPdf() {
  try { return JSON.parse(localStorage.getItem(LEGACY_PDF_KEY) || "{}"); }
  catch { return {}; }
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
  const [page, setPage] = useState("makerHome");
  const [certificates, setCertificates] = useState([]);
  const [certificate, setCertificate] = useState(null);
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
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
  const session = useExamSession();

  useEffect(() => (firebaseConfigured ? onAuthStateChanged(auth, setUser) : undefined), []);
  useEffect(() => { listCertificates().then(setCertificates).catch(console.error); }, []);
  useEffect(() => { if (certificate) listExams(certificate.id).then(setExams).catch(console.error); }, [certificate]);
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
    if (!user) { setCloudLoadedForUid(""); setCloudReady(true); return; }
    setCloudLoadedForUid("");
    setCloudReady(false);
    Promise.all([
      loadCloudState(user.uid),
      listUserAttemptEvents(user.uid).catch(() => []),
    ])
      .then(([data, cloudAttempts]) => {
        if (data) {
          const migrated = migrateLearningState(data);
          setHistory(migrated.history || []);
          setPracticeHistory(migrated.practiceHistory || []);
          setWrongNotes(migrated.wrongNotes || []);
          setLearningProgress(migrated.learningProgress || []);
          setStudyEvents(migrated.studyEvents || []);
          setPlan(migrated.plan || {});
          setQuestionBookmarks(migrated.questionBookmarks || []);
          setActiveCertificateId(String(migrated.activeCertificateId || data.activeCertificateId || ""));
        }
        if (cloudAttempts.length) setAttemptEvents(cloudAttempts);
        setCloudLoadedForUid(user.uid);
        setCloudReady(true);
      })
      .catch(() => { setCloudLoadedForUid(user.uid); setCloudReady(true); });
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
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    if (user && cloudReady && cloudLoadedForUid === user.uid) {
      const cloudState = { history, practiceHistory, wrongNotes, learningProgress, studyEvents, plan, questionBookmarks, activeCertificateId: certificate?.id || activeCertificateId };
      const id = setTimeout(() => saveCloudState(user.uid, cloudState).catch(console.error), 500);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [history, practiceHistory, wrongNotes, learningProgress, studyEvents, attemptEvents, plan, questionBookmarks, pdfQuizHistory, pdfQuizWrongNotes, activeCertificateId, certificate?.id, user, cloudReady, cloudLoadedForUid]);
  useEffect(() => {
    saveMakerState({ inventorProjects, buildProjects, portfolioItems, awards, certifications, resumeProfile, careerProfile });
  }, [inventorProjects, buildProjects, portfolioItems, awards, certifications, resumeProfile, careerProfile]);

  const active = useMemo(
    () => page === "mode" ? "past" : page === "exam" ? (session.exam?.sourceType === "pdf" ? "pdfstudy" : "past") : page,
    [page, session.exam?.sourceType],
  );
  const legacyPdf = readLegacyPdf();
  const pdfWrongNotes = (legacyPdf.wrongNotes || []).filter((question) => !question.examId);
  const activeBookmarks = useMemo(
    () => session.questions.filter((question, index) => session.bookmarks[index]),
    [session.bookmarks, session.questions],
  );
  const savedBookmarks = useMemo(
    () => [...activeBookmarks, ...questionBookmarks].filter((question, index, array) => array.findIndex((item) => item.id === question.id) === index),
    [activeBookmarks, questionBookmarks],
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
    const questions = await getExamQuestions(selectedExam.id);
    const practice = mode === "연습모드";
    session.start({
      ...selectedExam,
      assessmentType: practice ? "practice" : "exam",
      studyScope: practice ? "exam-practice" : "exam",
      learningType: practice ? "examPractice" : "exam",
      returnPage: "past",
    }, questions, mode);
    setPage("exam");
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

  function recordFinishedSession() {
    if (!session.submitted || !session.questions.length) return;
    const result = session.result;
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
      return;
    }

    const certificateId = session.exam?.certificateId || certificate?.id || "";
    const certificateName = session.exam?.certificateName || certificate?.name || "";
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
      .map((question) => ({ ...question, examTitle: session.exam?.title || "시험", savedAt: now }));
    if (bookmarked.length) {
      setQuestionBookmarks((previous) => [...bookmarked, ...previous]
        .filter((question, index, array) => array.findIndex((item) => item.id === question.id) === index)
        .slice(0, 1000));
    }
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

  function finishExam() {
    recordFinishedSession();
    const scope = resolveStudyScope(session.exam, session.mode);
    const fallback = {
      pdf: "pdfstudy",
      subject: "subject",
      topic: "topic",
      recommended: "learning",
      "wrong-review": "bookmark",
      "due-review": "learning",
      search: "search",
      "exam-practice": "past",
      exam: "past",
      mock: "mock",
    }[scope] || "past";
    setPage(session.exam?.returnPage || fallback);
  }

  function navigate(next) {
    if (!certificate && ["certificate", "past", "subject", "topic", "mock", "bookmark", "search", "planner", "learning", "report"].includes(next)) {
      setPage("catalog");
      return;
    }
    if (next === "graph") setGraphQuery("");
    if (next === "notes") setAssetFocus(null);
    if (next === "tutor" && page !== "pdfstudy") setTutorSeed({ question: "", pdfId: "" });
    setPage(next);
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
    if (!questions.length) { alert("복습 가능한 문제 원문이 없습니다. 새 버전에서 푼 문제부터 복습할 수 있습니다."); return; }
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
    if (!pool.length) { alert("추천 문제를 만들 수 있는 기출문제가 없습니다."); return; }
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
    session.start({
      id: `pdf-${Date.now()}`,
      title: `${meta?.name || "PDF"} · 이해도 확인`,
      durationMinutes: normalized.length,
      hasSubjectCutoff: false,
      assessmentType: "practice",
      studyScope: "pdf",
      learningType: "pdfPractice",
      sourceType: "pdf",
      pdfId: meta?.pdfId || "",
      sourceName: meta?.name || "PDF",
      returnPage: "pdfstudy",
    }, normalized, "연습모드");
    setPage("exam");
  }

  function openTutorWithPdf(name) {
    const document = pdfLibrary.find((item) => String(item.name || "").replace(/\.pdf$/i, "").trim() === String(name || "").replace(/\.pdf$/i, "").trim())
      || pdfLibrary.find((item) => item.name === name);
    setTutorSeed({ question: "", pdfId: document?.id || "" });
    setPage("tutor");
  }

  async function createAssetsFromPdf(document) {
    if (!document?.pages?.length) { alert("이 PDF는 텍스트가 저장되지 않아 AI 자료를 만들 수 없습니다. PDF를 다시 업로드해 주세요."); return; }
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
      alert(error.message);
    } finally {
      setAssetBusy(false);
    }
  }

  async function createAssetsFromWrong() {
    if (!wrongNotes.length) { alert("CBT 오답이 없습니다."); return; }
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
      alert(error.message);
    } finally {
      setAssetBusy(false);
    }
  }

  function deleteAsset(type, id) {
    const next = { ...assets, [type]: (assets[type] || []).filter((item) => item.id !== id) };
    saveStudyAssets(next);
    setAssets(next);
  }

  function openStudyAsset(type, item) {
    if (!item?.id) return;
    setAssetFocus({ type, id: item.id, openedAt: Date.now() });
    setPage("notes");
  }

  const repeatedWrong = useMemo(() => buildRepeatedWrong(certificateLearningProgress), [certificateLearningProgress]);
  const dueReviews = useMemo(() => getDueReviews(certificateLearningProgress), [certificateLearningProgress]);

  return (
    <div className="app">
      <AppHeader active={active} onNavigate={navigate} certificateName={certificate?.name} user={user} onLogin={() => setShowAuth(true)} isAdmin={isAdminUser(user)} />
      {page === "makerHome" && <MakerHomePage onNavigate={navigate} history={history} wrongNotes={wrongNotes} pdfLibrary={pdfLibrary} assets={assets} inventorProjects={inventorProjects} buildProjects={buildProjects} />}
      {page === "invent" && <InventPage projects={inventorProjects} onChangeProjects={setInventorProjects} onCreateBuildProject={createBuildProject} />}
      {page === "projects" && <ProjectsPage projects={buildProjects} inventorProjects={inventorProjects} onChangeProjects={setBuildProjects} onOpenInvent={() => setPage("invent")} />}
      {page === "portfolio" && <PortfolioPage inventorProjects={inventorProjects} buildProjects={buildProjects} history={history} assets={assets} resumeProfile={resumeProfile} onChangeResumeProfile={setResumeProfile} awards={awards} onChangeAwards={setAwards} certifications={certifications} onChangeCertifications={setCertifications} portfolioItems={portfolioItems} onChangePortfolioItems={setPortfolioItems} />}
      {page === "career" && <CareerPage assets={assets} inventorProjects={inventorProjects} buildProjects={buildProjects} pdfLibrary={pdfLibrary} history={history} awards={awards} certifications={certifications} onNavigate={navigate} />}
      {page === "catalog" && <CatalogPage certificates={certificates} onSelect={selectCertificate} history={history} wrongNotes={wrongNotes} pdfLibrary={pdfLibrary} onNavigate={navigate} />}
      {page === "certificate" && <CertificateHomePage certificate={certificate} exams={exams} history={certificateHistory} practiceHistory={certificatePracticeHistory} wrongNotes={certificateWrongNotes} learningProgress={certificateLearningProgress} plan={plan} pdfLibrary={pdfLibrary} onNavigate={navigate} onOpenExam={openExam} loadQuestions={getExamQuestions} />}
      {page === "learning" && <LearningCenterPage certificate={certificate} history={certificateHistory} practiceHistory={certificatePracticeHistory} wrongNotes={certificateWrongNotes} learningProgress={certificateLearningProgress} plan={plan} pdfLibrary={pdfLibrary} exams={exams} loadQuestions={getExamQuestions} onStartRecommended={startRecommended} onStartDueReview={startDueReview} onStartRepeatedWrong={startWrongReview} onNavigate={navigate} />}
      {page === "knowledge" && <UnifiedSearchPage searchCbt={searchQuestions} pdfLibrary={pdfLibrary} wrongNotes={[...wrongNotes, ...pdfWrongNotes]} bookmarks={savedBookmarks} notes={assets.notes} cards={assets.cards} onOpenCbt={openSearchResult} onOpenPdf={openPdf} />}
      {page === "library" && <PdfLibraryPage library={pdfLibrary} onRefresh={() => setPdfLibrary(readPdfLibrary())} onOpen={openPdf} onCreateAssets={createAssetsFromPdf} />}
      {page === "pdfstudy" && <PdfStudyPage library={pdfLibrary} onRefresh={() => setPdfLibrary(readPdfLibrary())} onStartQuiz={startPdfQuiz} onOpenTutor={openTutorWithPdf} />}
      {page === "notes" && <NotesCardsPage assets={assets} onDelete={deleteAsset} onGenerateFromWrong={createAssetsFromWrong} busy={assetBusy} initialFocus={assetFocus} />}
      {page === "report" && <GrowthReportPage certificate={certificate} history={certificateHistory} practiceHistory={certificatePracticeHistory} studyEvents={certificateStudyEvents} wrongNotes={certificateWrongNotes} learningProgress={certificateLearningProgress} />}
      {page === "tutor" && <AiTutorPage certificate={certificate} initialQuery={tutorSeed.question} initialPdfId={tutorSeed.pdfId} wrongNotes={wrongNotes} pdfLibrary={pdfLibrary} assets={assets} searchCbt={searchQuestions} onOpenCbt={openSearchResult} onOpenPdf={openPdf} onOpenGraph={(query) => { setGraphQuery(query); setPage("graph"); }} />}
      {page === "graph" && <KnowledgeGraphPage initialQuery={graphQuery} wrongNotes={wrongNotes} pdfLibrary={pdfLibrary} assets={assets} searchCbt={searchQuestions} onOpenCbt={openSearchResult} onOpenPdf={openPdf} onOpenAsset={openStudyAsset} onAskTutor={(payload) => { const value = typeof payload === "string" ? { question: payload, pdfId: "" } : payload || { question: "", pdfId: "" }; setTutorSeed(value); setPage("tutor"); }} />}
      {page === "past" && <PastExamsPage exams={exams} loadQuestions={getExamQuestions} onOpen={openExam} onNavigate={navigate} />}
      {page === "subject" && <SubjectStudyPage certificate={certificate} exams={exams} history={certificatePracticeHistory.filter((item) => item.studyScope === "subject")} loadQuestions={getExamQuestions} onStart={(questions, exam) => { session.start({ ...exam, assessmentType: "practice", studyScope: "subject", learningType: "subjectPractice", returnPage: "subject" }, questions, "연습모드"); setPage("exam"); }} onNavigate={navigate} />}
      {page === "topic" && <TopicStudyPage certificate={certificate} exams={exams} history={certificatePracticeHistory.filter((item) => item.studyScope === "topic")} learningProgress={certificateLearningProgress} loadQuestions={getExamQuestions} onStart={(questions, exam) => { session.start({ ...exam, assessmentType: "practice", studyScope: "topic", learningType: "topicPractice", returnPage: "topic" }, questions, "연습모드"); setPage("exam"); }} onNavigate={navigate} />}
      {page === "mode" && <ModeSelectPage exam={selectedExam} onStart={startExam} onBack={() => setPage("past")} />}
      {page === "exam" && <ExamPage session={session} onExit={finishExam} onSaveConfidence={saveConfidenceRecord} getDifficulty={getDifficulty} />}
      {page === "mock" && <MockExamPage exams={exams} loadQuestions={getExamQuestions} onStart={(questions, exam) => { session.start({ ...exam, assessmentType: "exam", studyScope: "mock", learningType: "mock", returnPage: "mock", certificateId: certificate?.id || "", certificateName: certificate?.name || "" }, questions, "실전모드"); setPage("exam"); }} />}
      {page === "bookmark" && <BookmarkPage wrongNotes={certificateWrongNotes} certificateName={certificate?.name} history={certificateHistory} onStartRecommended={startRecommended} onStartWrongReview={startWrongReview} repeatedWrong={repeatedWrong} dueReviews={dueReviews} onStartDueReview={startDueReview} />}
      {page === "search" && <SearchPage exams={exams} searchQuestions={async (term) => (await searchQuestions(term)).map((item) => item.q)} onOpenResult={(exam, question) => openSearchResult(exam, question)} />}
      {page === "stats" && <StudyStatsPage examHistory={history} practiceHistory={practiceHistory} studyEvents={studyEvents} attemptEvents={attemptEvents} learningProgress={learningProgress} certificates={certificates} selectedCertificateId={certificate?.id || ""} onRecalculate={recalculateLearningData} onReset={resetLearningData} />}
      {page === "planner" && <PlannerPage certificate={certificate} wrongNotes={certificateWrongNotes} history={certificateHistory} practiceHistory={certificatePracticeHistory} learningProgress={certificateLearningProgress} exams={exams} plan={plan} onSavePlan={setPlan} onStartRecommended={startRecommended} onStartDueReview={startDueReview} onStartRepeatedWrong={startWrongReview} pdfLibrary={pdfLibrary} />}
      {page === "admin" && isAdminUser(user) && <AdminPage />}
      {showAuth && <AuthModal user={user} onClose={() => setShowAuth(false)} />}
      <div className="sync-indicator">{assetBusy ? "AI 자료 생성 중…" : user ? (cloudReady ? "클라우드 동기화" : "동기화 중…") : "이 기기에 자동 저장"}</div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
