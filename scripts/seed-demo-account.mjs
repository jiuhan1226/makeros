import "dotenv/config";
import { initializeApp, deleteApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  Timestamp,
  where,
  writeBatch,
  terminate,
} from "firebase/firestore";

const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!Object.values(config).every(Boolean)) {
  throw new Error(".env의 VITE_FIREBASE_* 설정을 먼저 채워 주세요.");
}

const email = String(process.env.DEMO_ACCOUNT_EMAIL || "").trim();
const password = String(process.env.DEMO_ACCOUNT_PASSWORD || "").trim();
const preferredCertificateId = String(process.env.DEMO_CERTIFICATE_ID || "").trim();

if (!email || password.length < 6) {
  throw new Error("DEMO_ACCOUNT_EMAIL과 6자 이상의 DEMO_ACCOUNT_PASSWORD를 설정해 주세요.");
}

const app = initializeApp(config, `makeros-demo-seed-${Date.now()}`);
const auth = getAuth(app);
const db = getFirestore(app);
const DAY = 24 * 60 * 60 * 1000;

function safeId(value) {
  return String(value || "").trim().replace(/\//g, "-").replace(/\s+/g, "_");
}

function toMillis(value) {
  return value instanceof Date ? value.getTime() : Number(value || Date.now());
}

function isoDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

async function authenticateDemoUser() {
  try {
    return await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    if (String(error?.code).includes("email-already-in-use")) {
      return signInWithEmailAndPassword(auth, email, password);
    }
    throw error;
  }
}

async function selectCertificate() {
  if (preferredCertificateId) {
    const snapshot = await getDoc(doc(db, "certificates", preferredCertificateId));
    if (!snapshot.exists()) throw new Error(`DEMO_CERTIFICATE_ID '${preferredCertificateId}'를 찾지 못했습니다.`);
    return { id: snapshot.id, ...snapshot.data() };
  }
  const snapshot = await getDocs(collection(db, "certificates"));
  if (snapshot.empty) throw new Error("등록된 자격증이 없습니다. 먼저 CBT 데이터를 등록해 주세요.");
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

async function loadCatalog(certificateId) {
  const [examSnapshot, questionSnapshot] = await Promise.all([
    getDocs(query(collection(db, "cbtExams"), where("certificateId", "==", certificateId))),
    getDocs(query(collection(db, "cbtQuestions"), where("certificateId", "==", certificateId))),
  ]);
  const exams = examSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => Number(b.year || 0) - Number(a.year || 0) || String(b.round || "").localeCompare(String(a.round || ""), "ko"));
  const questions = questionSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  if (!exams.length || !questions.length) throw new Error("선택한 자격증에 시험과 문제가 충분히 등록되어 있지 않습니다.");
  return { exams, questions };
}

function pickQuestions(exams, questions, maxQuestions = 240) {
  const targetExams = exams.slice(0, Math.min(8, exams.length));
  const byExam = new Map(targetExams.map((exam) => [exam.id, []]));
  for (const question of questions) {
    const examId = String(question.sourceExamId || question.examId || "");
    if (byExam.has(examId)) byExam.get(examId).push(question);
  }
  const selected = [];
  const perExam = Math.max(1, Math.ceil(maxQuestions / targetExams.length));
  for (const exam of targetExams) selected.push(...(byExam.get(exam.id) || []).slice(0, perExam));
  if (selected.length < Math.min(maxQuestions, questions.length)) {
    const used = new Set(selected.map((item) => item.id));
    selected.push(...questions.filter((item) => !used.has(item.id)).slice(0, maxQuestions - selected.length));
  }
  return { targetExams, questions: selected.slice(0, maxQuestions) };
}

function buildProgress(question, index, certificate, now) {
  const tier = index % 20;
  const sourceExamId = String(question.sourceExamId || question.examId || "");
  const lastSolvedAt = now - ((index % 32) + 1) * DAY;
  let stage;
  if (tier < 8) stage = "mastered";
  else if (tier < 13) stage = "proficient";
  else if (tier < 18) stage = "understanding";
  else stage = "answered";

  const stageData = {
    mastered: { attempts: 3, correct: 3, wrong: 0, confidence: "high", reviewLevel: 3, correctDays: 3, lastReviewSuccess: true, isCorrect: true, nextDays: 16, learningType: "srsReview", scope: "due-review" },
    proficient: { attempts: 2, correct: 2, wrong: 0, confidence: "high", reviewLevel: 1, correctDays: 2, lastReviewSuccess: false, isCorrect: true, nextDays: 7, learningType: "topicPractice", scope: "topic" },
    understanding: { attempts: 2, correct: 1, wrong: 1, confidence: "medium", reviewLevel: 0, correctDays: 1, lastReviewSuccess: false, isCorrect: true, nextDays: index % 3 === 0 ? -2 : 3, learningType: "subjectPractice", scope: "subject" },
    answered: { attempts: 1, correct: 0, wrong: 1, confidence: "low", reviewLevel: 0, correctDays: 0, lastReviewSuccess: false, isCorrect: false, nextDays: -1, learningType: "examPractice", scope: "exam-practice" },
  }[stage];

  const correctDayKeys = Array.from({ length: stageData.correctDays }, (_, dayIndex) => isoDay(lastSolvedAt - dayIndex * 7 * DAY));
  const answerIndex = Number(question.answerIndex || 0);
  const selectedAnswerIndex = stageData.isCorrect ? answerIndex : (answerIndex + 1) % Math.max(2, question.choices?.length || 4);
  const common = {
    questionId: question.id,
    examId: sourceExamId,
    sourceExamId,
    examYear: Number(question.year || 0) || "",
    certificateId: certificate.id,
    certificateName: certificate.name || "",
    subject: String(question.subject || "공통"),
    topic: String(question.topic || question.tags?.[0] || "핵심 개념"),
    topicSource: question.topicSource || "seed",
    topicConfidence: Number(question.topicConfidence || 0.8),
    tags: Array.isArray(question.tags) ? question.tags : [],
    mode: "연습모드",
    studyScope: stageData.scope,
    learningType: stageData.learningType,
    attemptCount: stageData.attempts,
    correctCount: stageData.correct,
    wrongCount: stageData.wrong,
    wrongStreak: stageData.isCorrect ? 0 : 1,
    correctDayKeys,
    distinctCorrectDays: correctDayKeys.length,
    lastReviewSuccess: stageData.lastReviewSuccess,
    lastAnswerIndex: selectedAnswerIndex,
    correctAnswerIndex: answerIndex,
    isCorrect: stageData.isCorrect,
    confidence: stageData.confidence,
    reviewLevelBeforeAttempt: Math.max(0, stageData.reviewLevel - 1),
    reviewLevel: stageData.reviewLevel,
    nextReviewAt: lastSolvedAt + stageData.nextDays * DAY,
    lastSolvedAt,
    updatedAt: now,
    lastAttemptId: `seed-${question.id}-${stageData.attempts}`,
    question: String(question.question || ""),
    choices: Array.isArray(question.choices) ? question.choices : [],
    explanation: String(question.explanation || ""),
    difficulty: stage === "answered" ? "hard" : stage === "understanding" ? "medium" : "easy",
  };
  return { stage, common, stageData };
}

function buildAttempts(progressRecord, question, stageData, certificate, now) {
  const attempts = [];
  for (let attempt = 1; attempt <= stageData.attempts; attempt += 1) {
    const answeredAt = progressRecord.lastSolvedAt - (stageData.attempts - attempt) * 7 * DAY;
    const finalAttempt = attempt === stageData.attempts;
    const isCorrect = finalAttempt ? progressRecord.isCorrect : (progressRecord.correctCount >= attempt);
    const selected = isCorrect
      ? progressRecord.correctAnswerIndex
      : (progressRecord.correctAnswerIndex + attempt) % Math.max(2, question.choices?.length || 4);
    const attemptId = `seed:${question.id}:${attempt}`;
    attempts.push({
      id: safeId(attemptId),
      data: {
        attemptId,
        sessionId: `seed-session-${String(question.sourceExamId || question.examId || "general")}`,
        questionId: question.id,
        examId: progressRecord.examId,
        sourceExamId: progressRecord.sourceExamId,
        certificateId: certificate.id,
        certificateName: certificate.name || "",
        subject: progressRecord.subject,
        topic: progressRecord.topic,
        tags: progressRecord.tags,
        studyScope: progressRecord.studyScope,
        learningType: progressRecord.learningType,
        mode: "연습모드",
        selectedAnswerIndex: selected,
        correctAnswerIndex: progressRecord.correctAnswerIndex,
        isCorrect,
        confidence: finalAttempt ? progressRecord.confidence : (isCorrect ? "medium" : "low"),
        question: progressRecord.question,
        choices: progressRecord.choices,
        explanation: progressRecord.explanation,
        questionData: { ...question, certificateId: certificate.id, certificateName: certificate.name || "" },
        examData: { id: progressRecord.examId, certificateId: certificate.id, certificateName: certificate.name || "", assessmentType: "practice", studyScope: progressRecord.studyScope, learningType: progressRecord.learningType, title: "시연 학습" },
        answeredAt: Timestamp.fromMillis(answeredAt),
        updatedAt: Timestamp.fromMillis(now),
      },
    });
  }
  return attempts;
}

async function deleteSubcollection(uid, name) {
  const snapshot = await getDocs(collection(db, "users", uid, name));
  for (let index = 0; index < snapshot.docs.length; index += 400) {
    const batch = writeBatch(db);
    snapshot.docs.slice(index, index + 400).forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
}

async function seed() {
  console.log("[1/5] 심사 계정을 확인하고 있습니다.");
  const credential = await authenticateDemoUser();
  const uid = credential.user.uid;
  console.log("[2/5] 자격증과 CBT 문제를 불러오고 있습니다.");
  const certificate = await selectCertificate();
  const { exams, questions } = await loadCatalog(certificate.id);
  const picked = pickQuestions(exams, questions, 240);
  console.log(`[3/5] ${picked.targetExams.length}개 시험에서 ${picked.questions.length}문제의 학습 기록을 구성합니다.`);
  if (picked.questions.length < 40) throw new Error("데모 데이터에는 최소 40개의 CBT 문제가 필요합니다.");

  const now = Date.now();
  const progress = [];
  const attempts = [];
  for (const [index, question] of picked.questions.entries()) {
    const built = buildProgress(question, index, certificate, now);
    progress.push(built.common);
    attempts.push(...buildAttempts(built.common, question, built.stageData, certificate, now));
  }

  const wrongNotes = progress.filter((item) => item.wrongCount > 0).slice(0, 36).map((item, index) => ({
    ...item,
    id: item.questionId,
    selectedAnswerIndex: item.lastAnswerIndex,
    answerIndex: item.correctAnswerIndex,
    wrongCount: item.wrongCount,
    firstWrongAt: item.lastSolvedAt - 10 * DAY,
    lastWrongAt: item.lastSolvedAt,
    createdAt: item.lastSolvedAt,
    lastWrongAttemptId: `seed-wrong-${index}`,
  }));

  const scores = [76, 73, 69, 66, 62];
  const history = scores.map((score, index) => ({
    sessionId: `seed-mock-${index + 1}`,
    title: `맞춤 모의고사 ${index + 1}`,
    examId: picked.targetExams[index % picked.targetExams.length]?.id || `seed-exam-${index + 1}`,
    certificateId: certificate.id,
    certificateName: certificate.name || "",
    mode: "실전모드",
    assessmentType: "exam",
    studyScope: "mock",
    learningType: "mock",
    score,
    total: 60,
    correct: Math.round(score * 0.6),
    wrong: 60 - Math.round(score * 0.6),
    answered: 60,
    unanswered: 0,
    passed: score >= 60,
    resultLabel: score >= 60 ? "합격" : "불합격",
    subjects: [],
    createdAt: now - index * 9 * DAY,
  }));

  const practiceHistory = Array.from({ length: 14 }, (_, index) => ({
    sessionId: `seed-practice-${index + 1}`,
    title: index % 2 ? "주제별 빠른 학습" : "과목별 빠른 학습",
    examId: picked.targetExams[index % picked.targetExams.length]?.id || "",
    certificateId: certificate.id,
    certificateName: certificate.name || "",
    mode: "연습모드",
    assessmentType: "practice",
    studyScope: index % 2 ? "topic" : "subject",
    learningType: index % 2 ? "topicPractice" : "subjectPractice",
    score: 55 + (index % 6) * 6,
    total: 20,
    correct: 11 + (index % 6),
    wrong: 9 - Math.min(5, index % 6),
    answered: 20,
    unanswered: 0,
    resultLabel: "학습 완료",
    subjects: [],
    createdAt: now - index * 2 * DAY,
  }));

  const studyEvents = [...history, ...practiceHistory].map((item) => ({
    type: item.assessmentType === "practice" ? "practice" : "exam",
    studyScope: item.studyScope,
    learningType: item.learningType,
    examId: item.examId,
    certificateId: certificate.id,
    certificateName: certificate.name || "",
    questionCount: item.total,
    durationSeconds: item.total * 52,
    createdAt: item.createdAt,
  }));

  const examDate = new Date(now + 60 * DAY).toISOString().slice(0, 10);
  const state = {
    history,
    practiceHistory,
    wrongNotes,
    learningProgress: progress,
    studyEvents,
    plan: { examDate, dailyGoal: 30, pdfGoal: 5, studyDays: [1, 2, 3, 4, 5, 6] },
    questionBookmarks: picked.questions.slice(0, 8),
    activeCertificateId: certificate.id,
  };

  console.log("[4/5] 기존 심사 계정 학습 데이터를 정리하고 있습니다.");
  await Promise.all(["cbtProgress", "cbtPracticeProgress", "cbtAttempts", "aiExplanationCache"].map((name) => deleteSubcollection(uid, name)));
  console.log("[5/5] Firestore에 학습 기록을 저장하고 있습니다.");
  await setDoc(doc(db, "users", uid, "studylock", "state"), { ...state, updatedAt: Timestamp.fromMillis(now) });

  for (let index = 0; index < progress.length; index += 350) {
    const batch = writeBatch(db);
    progress.slice(index, index + 350).forEach((item) => {
      const name = ["exam", "mock"].includes(item.learningType) ? "cbtProgress" : "cbtPracticeProgress";
      batch.set(doc(db, "users", uid, name, safeId(item.questionId)), {
        ...item,
        nextReviewAt: Timestamp.fromMillis(item.nextReviewAt),
        lastSolvedAt: Timestamp.fromMillis(item.lastSolvedAt),
        updatedAt: Timestamp.fromMillis(now),
      });
    });
    await batch.commit();
  }

  for (let index = 0; index < attempts.length; index += 350) {
    const batch = writeBatch(db);
    attempts.slice(index, index + 350).forEach((item) => batch.set(doc(db, "users", uid, "cbtAttempts", item.id), item.data));
    await batch.commit();
  }

  console.log("\nMakerOS 심사 계정 학습 데이터 준비 완료");
  console.log(`이메일: ${email}`);
  console.log(`UID: ${uid}`);
  console.log(`자격증: ${certificate.name || certificate.id}`);
  console.log(`기출 회차: ${picked.targetExams.length}개`);
  console.log(`학습 문제: ${progress.length}개`);
  console.log(`원본 풀이 이벤트: ${attempts.length}개`);
  console.log("\n접속 방법: 배포된 MakerOS의 일반 이메일 로그인 화면에서 위 계정으로 로그인하세요.");
}

try {
  await seed();
} finally {
  try { await signOut(auth); } catch {}
  try { await terminate(db); } catch {}
  await deleteApp(app);
}
