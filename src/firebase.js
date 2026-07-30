import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { normalizeQuestionTopic } from "./utils/topicClassifier.js";
import { resolveLearningType } from "./utils/learningEngine.js";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);
const adminUids = String(import.meta.env.VITE_ADMIN_UIDS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

let app = null;
let auth = null;
let db = null;
let storage = null;
if (firebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export {
  auth,
  db,
  storage,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
};

export const isAdminUser = (user) => Boolean(user && adminUids.includes(user.uid));

export async function signInGoogle() {
  if (!auth) throw new Error("Firebase 설정이 필요합니다.");
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export async function loadCloudState(uid) {
  if (!db) return null;
  const snapshot = await getDoc(doc(db, "users", uid, "studylock", "state"));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function saveCloudState(uid, state) {
  if (!db) return;
  await setDoc(
    doc(db, "users", uid, "studylock", "state"),
    { ...state, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function listCertificates() {
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, "certificates"), orderBy("name")));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function saveCertificate(data) {
  if (!db) throw new Error("Firebase 설정이 필요합니다.");
  const id = String(data.id || "").trim();
  if (!id) throw new Error("자격증 ID가 필요합니다.");
  await setDoc(doc(db, "certificates", id), { ...data, id, updatedAt: serverTimestamp() }, { merge: true });
}

export async function listExams(certificateId = null, publishedOnly = true) {
  if (!db) return [];
  const examQuery = certificateId
    ? query(collection(db, "cbtExams"), where("certificateId", "==", certificateId))
    : query(collection(db, "cbtExams"));
  const snapshot = await getDocs(examQuery);
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => !publishedOnly || item.status === "published")
    .sort((a, b) => (Number(b.year) - Number(a.year)) || String(b.round).localeCompare(String(a.round), "ko"));
}

function sanitizeDocumentId(value) {
  return String(value ?? "")
    .trim()
    .replace(/\//g, "-")
    .replace(/\s+/g, "_");
}

export function createExamId(exam) {
  const certificateId = sanitizeDocumentId(exam?.certificateId);
  const year = sanitizeDocumentId(exam?.year);
  const round = sanitizeDocumentId(exam?.round);
  if (!certificateId || !year || !round) throw new Error("자격증, 연도, 회차를 모두 입력해 주세요.");
  return `${certificateId}_${year}_${round}`;
}

export async function saveExam(data) {
  if (!db) throw new Error("Firebase 설정이 필요합니다.");
  const examId = createExamId(data);
  const normalizedExam = {
    ...data,
    id: examId,
    year: Number(data.year),
    round: String(data.round ?? "").trim(),
    examDate: String(data.examDate ?? "").trim(),
    durationMinutes: Number(data.durationMinutes) || 60,
    passScore: Number(data.passScore) || 60,
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, "cbtExams", examId), normalizedExam, { merge: true });
  return normalizedExam;
}

export async function deleteExam(examId) {
  if (!db) return;
  const questionSnapshot = await getDocs(query(collection(db, "cbtQuestions"), where("examId", "==", examId)));
  const chunks = [];
  for (let index = 0; index < questionSnapshot.docs.length; index += 400) {
    chunks.push(questionSnapshot.docs.slice(index, index + 400));
  }
  for (const part of chunks) {
    const batch = writeBatch(db);
    part.forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, "cbtExams", examId));
}

export async function getExamQuestions(examId) {
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, "cbtQuestions"), where("examId", "==", examId)));
  return snapshot.docs
    .map((item) => normalizeQuestionTopic({ id: item.id, ...item.data() }))
    .sort((a, b) => Number(a.questionNumber) - Number(b.questionNumber));
}

export async function importExamQuestions(exam, questions) {
  if (!db) throw new Error("Firebase 설정이 필요합니다.");
  const examId = createExamId(exam);
  const normalizedExam = {
    ...exam,
    id: examId,
    year: Number(exam.year),
    round: String(exam.round || "").trim(),
    examDate: String(exam.examDate || "").trim(),
  };

  const normalized = questions.map((question, index) => {
    const questionNumber = Number(question.questionNumber ?? index + 1);
    return {
      ...normalizeQuestionTopic({
      id: `${examId}_${String(questionNumber).padStart(3, "0")}`,
      examId,
      certificateId: normalizedExam.certificateId,
      certificateName: normalizedExam.certificateName,
      grade: normalizedExam.grade,
      year: normalizedExam.year,
      round: normalizedExam.round,
      questionNumber,
      subject: String(question.subject || "공통").trim(),
      topic: String(question.topic || "").trim(),
      chapter: String(question.chapter || "").trim(),
      unit: String(question.unit || "").trim(),
      category: String(question.category || "").trim(),
      subTopic: String(question.subTopic || "").trim(),
      keyword: String(question.keyword || "").trim(),
      tags: (Array.isArray(question.tags) ? question.tags : []).map((value) => String(value || "").trim()).filter(Boolean),
      question: String(question.question || "").trim(),
      choices: (question.choices || []).map((value) => String(value).trim()),
      answerIndex: Number(question.answerIndex),
      explanation: String(question.explanation || "").trim(),
      imageUrl: String(question.imageUrl || "").trim(),
      questionImageUrls: (question.questionImageUrls || []).map((value) => String(value).trim()).filter(Boolean),
      choiceImageUrls: (question.choiceImageUrls || []).map((value) => String(value || "").trim()),
      sourceName: String(normalizedExam.sourceName || question.sourceName || "").trim(),
      sourceUrl: String(normalizedExam.sourceUrl || question.sourceUrl || "").trim(),
      sourcePage: Number(question.sourcePage || 0),
      needsReview: Boolean(question.needsReview),
      examDate: normalizedExam.examDate,
      }),
      updatedAt: serverTimestamp(),
    };
  });

  for (let index = 0; index < normalized.length; index += 400) {
    const batch = writeBatch(db);
    normalized.slice(index, index + 400).forEach((question) => {
      batch.set(doc(db, "cbtQuestions", question.id), question, { merge: true });
    });
    await batch.commit();
  }

  await saveExam({ ...normalizedExam, questionCount: normalized.length });
  return normalized.length;
}

export async function uploadCbtImage(blob, path, contentType = "image/png") {
  if (!storage) throw new Error("Firebase Storage 설정이 필요합니다.");
  const target = ref(storage, path);
  await uploadBytes(target, blob, { contentType });
  return getDownloadURL(target);
}

function calculateNextReviewDate({ isCorrect, confidence, reviewLevel = 0 }) {
  let days = 1;
  if (!isCorrect) days = confidence === "medium" ? 2 : 1;
  else if (confidence === "low") days = 1;
  else if (confidence === "medium") days = 3;
  else if (reviewLevel >= 3) days = 30;
  else if (reviewLevel >= 2) days = 14;
  else days = 7;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return Timestamp.fromDate(date);
}

function reviewLevelForAttempt(baseLevel, isCorrect, confidence) {
  if (!isCorrect || confidence === "low") return 0;
  if (isCorrect && confidence === "high") return baseLevel + 1;
  return baseLevel;
}

export async function saveQuestionProgress({
  uid,
  question,
  exam,
  mode,
  studyScope,
  learningType,
  sessionId,
  attemptId,
  selectedAnswerIndex,
  isCorrect,
  confidence,
}) {
  if (!db) throw new Error("Firebase 설정이 필요합니다.");
  if (!uid) throw new Error("로그인이 필요합니다.");
  if (!question?.id) throw new Error("문제 ID가 없습니다.");
  if (!["high", "medium", "low"].includes(confidence)) throw new Error("자기평가 값이 올바르지 않습니다.");

  const normalizedQuestion = normalizeQuestionTopic(question);
  const practice = mode === "연습모드" || exam?.assessmentType === "practice";
  const progressCollection = practice ? "cbtPracticeProgress" : "cbtProgress";
  const normalizedStudyScope = String(studyScope || exam?.studyScope || (practice ? "exam-practice" : "exam"));
  const normalizedLearningType = String(learningType || resolveLearningType(exam || {}, mode, normalizedStudyScope));
  const progressRef = doc(db, "users", uid, progressCollection, normalizedQuestion.id);
  const progressSnapshot = await getDoc(progressRef);
  const previous = progressSnapshot.exists() ? progressSnapshot.data() : {};
  const normalizedAttemptId = String(attemptId || `${Date.now()}:${normalizedQuestion.id}`);
  const sameAttempt = previous.lastAttemptId === normalizedAttemptId;
  const baseLevel = sameAttempt
    ? Number(previous.reviewLevelBeforeAttempt ?? previous.reviewLevel ?? 0)
    : Number(previous.reviewLevel || 0);
  const reviewLevel = reviewLevelForAttempt(baseLevel, Boolean(isCorrect), confidence);
  const solvedDay = new Date().toISOString().slice(0, 10);
  const previousCorrectDays = Array.isArray(previous.correctDayKeys) ? previous.correctDayKeys : [];
  const correctDayKeys = Boolean(isCorrect) && !sameAttempt
    ? [...new Set([...previousCorrectDays, solvedDay])].slice(-30)
    : previousCorrectDays;

  const progressData = {
    questionId: normalizedQuestion.id,
    examId: exam?.id || normalizedQuestion.examId || "",
    sourceExamId: normalizedQuestion.sourceExamId || normalizedQuestion.examId || "",
    examYear: Number(normalizedQuestion.examYear || normalizedQuestion.year || 0) || "",
    certificateId: exam?.certificateId || normalizedQuestion.certificateId || "",
    certificateName: exam?.certificateName || normalizedQuestion.certificateName || "",
    subject: String(normalizedQuestion.subject || "공통").trim(),
    topic: normalizedQuestion.topic,
    topicSource: normalizedQuestion.topicSource,
    topicConfidence: normalizedQuestion.topicConfidence,
    tags: normalizedQuestion.tags,
    mode: String(mode || ""),
    studyScope: normalizedStudyScope,
    learningType: normalizedLearningType,
    attemptCount: Number(previous.attemptCount || 0) + (sameAttempt ? 0 : 1),
    correctCount: Number(previous.correctCount || 0) + (!sameAttempt && isCorrect ? 1 : 0),
    wrongCount: Number(previous.wrongCount || 0) + (!sameAttempt && !isCorrect ? 1 : 0),
    wrongStreak: sameAttempt ? Number(previous.wrongStreak || 0) : (isCorrect ? 0 : Number(previous.wrongStreak || 0) + 1),
    correctDayKeys,
    distinctCorrectDays: correctDayKeys.length,
    lastReviewSuccess: Boolean(isCorrect) && ["srsReview", "repeatedWrong"].includes(normalizedLearningType),
    lastAnswerIndex: Number(selectedAnswerIndex),
    correctAnswerIndex: Number(normalizedQuestion.answerIndex),
    isCorrect: Boolean(isCorrect),
    confidence,
    reviewLevelBeforeAttempt: baseLevel,
    reviewLevel,
    nextReviewAt: calculateNextReviewDate({ isCorrect, confidence, reviewLevel }),
    lastAttemptId: normalizedAttemptId,
    lastSolvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(progressRef, progressData, { merge: true });

  const attemptDocumentId = sanitizeDocumentId(normalizedAttemptId);
  const attemptRef = doc(db, "users", uid, "cbtAttempts", attemptDocumentId);
  await setDoc(attemptRef, {
    attemptId: normalizedAttemptId,
    sessionId: String(sessionId || normalizedAttemptId.split(":")[0] || ""),
    questionId: normalizedQuestion.id,
    examId: progressData.examId,
    sourceExamId: progressData.sourceExamId,
    certificateId: progressData.certificateId,
    certificateName: progressData.certificateName,
    subject: progressData.subject,
    topic: progressData.topic,
    tags: progressData.tags,
    studyScope: normalizedStudyScope,
    learningType: normalizedLearningType,
    mode: String(mode || ""),
    selectedAnswerIndex: Number(selectedAnswerIndex),
    correctAnswerIndex: Number(normalizedQuestion.answerIndex),
    isCorrect: Boolean(isCorrect),
    confidence,
    question: normalizedQuestion.question || "",
    choices: normalizedQuestion.choices || [],
    explanation: normalizedQuestion.explanation || "",
    questionData: normalizedQuestion,
    examData: {
      id: exam?.id || normalizedQuestion.examId || "",
      certificateId: exam?.certificateId || normalizedQuestion.certificateId || "",
      certificateName: exam?.certificateName || normalizedQuestion.certificateName || "",
      assessmentType: exam?.assessmentType || "",
      studyScope: normalizedStudyScope,
      learningType: normalizedLearningType,
      title: exam?.title || "",
    },
    answeredAt: previous.lastAttemptId === normalizedAttemptId
      ? (previous.lastSolvedAt || serverTimestamp())
      : serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return progressData;
}

export async function getTodayReviewProgress(uid) {
  if (!db || !uid) return [];
  const now = Timestamp.now();
  const snapshots = await Promise.all(["cbtProgress", "cbtPracticeProgress"].map((name) =>
    getDocs(query(collection(db, "users", uid, name), where("nextReviewAt", "<=", now), orderBy("nextReviewAt"))),
  ));
  return snapshots.flatMap((snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
    .sort((a, b) => Number(a.nextReviewAt?.seconds || 0) - Number(b.nextReviewAt?.seconds || 0));
}

export async function getRepeatedWrongProgress(uid) {
  if (!db || !uid) return [];
  const snapshots = await Promise.all(["cbtProgress", "cbtPracticeProgress"].map((name) =>
    getDocs(query(collection(db, "users", uid, name), where("wrongCount", ">=", 2), orderBy("wrongCount", "desc"))),
  ));
  return snapshots.flatMap((snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
    .sort((a, b) => Number(b.wrongCount || 0) - Number(a.wrongCount || 0));
}

export async function listUserAttemptEvents(uid) {
  if (!db || !uid) return [];
  const snapshot = await getDocs(collection(db, "users", uid, "cbtAttempts"));
  return snapshot.docs
    .map((item) => {
      const data = item.data();
      const answeredAt = Number(data.answeredAt?.toMillis?.() || data.answeredAt?.seconds * 1000 || data.answeredAt || 0);
      const questionData = data.questionData || {
        id: data.questionId || "",
        examId: data.examId || "",
        sourceExamId: data.sourceExamId || "",
        certificateId: data.certificateId || "",
        certificateName: data.certificateName || "",
        subject: data.subject || "공통",
        topic: data.topic || "",
        tags: data.tags || [],
        question: data.question || "",
        choices: data.choices || [],
        answerIndex: Number(data.correctAnswerIndex),
        explanation: data.explanation || "",
      };
      return {
        ...data,
        id: item.id,
        answeredAt,
        updatedAt: Number(data.updatedAt?.toMillis?.() || data.updatedAt?.seconds * 1000 || Date.now()),
        question: questionData,
        exam: data.examData || {
          id: data.examId || "",
          certificateId: data.certificateId || "",
          certificateName: data.certificateName || "",
          studyScope: data.studyScope || "",
          learningType: data.learningType || "",
        },
      };
    })
    .sort((a, b) => Number(b.answeredAt || 0) - Number(a.answeredAt || 0))
    .slice(0, 3000);
}

function aiExplanationDocId(questionHash) {
  return sanitizeDocumentId(String(questionHash || "").trim());
}

export async function getUserAiExplanation(uid, questionHash) {
  if (!db || !uid || !questionHash) return null;
  const snapshot = await getDoc(doc(db, "users", uid, "aiExplanationCache", aiExplanationDocId(questionHash)));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function saveUserAiExplanation(uid, result) {
  if (!db || !uid || !result?.questionHash || !result?.verified || !result?.signature) return;
  const cacheId = result.clientFingerprint || result.questionHash;
  await setDoc(
    doc(db, "users", uid, "aiExplanationCache", aiExplanationDocId(cacheId)),
    {
      ...result,
      uid,
      savedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function submitAiExplanationReview({ uid, question, result, reason = "verification_failed", comment = "" }) {
  if (!db || !uid || !question?.id) return null;
  const questionHash = String(result?.questionHash || "").trim();
  const reviewId = sanitizeDocumentId(`${question.id}_${questionHash || "nohash"}_${reason}_${Date.now()}`);
  const reviewRef = doc(db, "aiExplanationReviews", reviewId);
  await setDoc(reviewRef, {
    questionId: question.id,
    certificateId: question.certificateId || "",
    examId: question.examId || "",
    subject: question.subject || "공통",
    topic: question.topic || "",
    question: question.question || "",
    choices: question.choices || [],
    officialAnswerIndex: Number(question.answerIndex),
    questionHash,
    explanation: result?.explanation || "",
    keyPoint: result?.keyPoint || "",
    issues: Array.isArray(result?.issues) ? result.issues : [],
    reason,
    comment: String(comment || "").slice(0, 1000),
    reporterUid: uid,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return reviewId;
}

export async function submitAiExplanationFeedback({ uid, question, result, reason, comment = "" }) {
  if (!db || !uid || !question?.id || !reason) return null;
  const feedbackId = sanitizeDocumentId(`${uid}_${question.id}_${Date.now()}`);
  await setDoc(doc(db, "aiExplanationFeedback", feedbackId), {
    questionId: question.id,
    questionHash: result?.questionHash || "",
    explanationVersion: Number(result?.version || 1),
    reason: String(reason),
    comment: String(comment || "").slice(0, 1000),
    uid,
    createdAt: serverTimestamp(),
  });
  let reviewQueued = false;
  if (["answer_conflict", "content_error"].includes(reason)) {
    try {
      await submitAiExplanationReview({ uid, question, result, reason, comment });
      reviewQueued = true;
    } catch (error) {
      console.warn("AI 해설 관리자 검토 등록 실패", error);
    }
  }
  return { feedbackId, reviewQueued };
}

export async function listAiExplanationReviews(status = "pending") {
  if (!db) return [];
  const reviewQuery = status
    ? query(collection(db, "aiExplanationReviews"), where("status", "==", status))
    : query(collection(db, "aiExplanationReviews"));
  const snapshot = await getDocs(reviewQuery);
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => Number(b.createdAt?.seconds || 0) - Number(a.createdAt?.seconds || 0));
}

export async function updateAiExplanationReview(reviewId, updates = {}) {
  if (!db || !reviewId) return;
  await setDoc(doc(db, "aiExplanationReviews", reviewId), {
    ...updates,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}


async function deleteDocumentRefs(refs = []) {
  for (let index = 0; index < refs.length; index += 400) {
    const batch = writeBatch(db);
    refs.slice(index, index + 400).forEach((itemRef) => batch.delete(itemRef));
    await batch.commit();
  }
}

function progressDocumentData(record = {}) {
  const nextReviewAt = Number(record.nextReviewAt || 0);
  const lastSolvedAt = Number(record.lastSolvedAt || 0);
  return {
    ...record,
    nextReviewAt: nextReviewAt ? Timestamp.fromMillis(nextReviewAt) : null,
    lastSolvedAt: lastSolvedAt ? Timestamp.fromMillis(lastSolvedAt) : null,
    updatedAt: serverTimestamp(),
  };
}

export async function replaceCloudLearningProgress(uid, records = [], certificateId = "") {
  if (!db || !uid) return;
  const collectionNames = ["cbtProgress", "cbtPracticeProgress"];
  const snapshots = await Promise.all(collectionNames.map((name) => getDocs(collection(db, "users", uid, name))));
  const deleteRefs = snapshots.flatMap((snapshot) => snapshot.docs)
    .filter((item) => !certificateId || item.data()?.certificateId === certificateId)
    .map((item) => item.ref);
  await deleteDocumentRefs(deleteRefs);

  const filtered = records.filter((item) => !certificateId || item.certificateId === certificateId);
  for (let index = 0; index < filtered.length; index += 350) {
    const batch = writeBatch(db);
    filtered.slice(index, index + 350).forEach((record) => {
      const examType = ["exam", "mock"].includes(record.learningType);
      const name = examType ? "cbtProgress" : "cbtPracticeProgress";
      batch.set(
        doc(db, "users", uid, name, sanitizeDocumentId(record.questionId)),
        progressDocumentData(record),
        { merge: true },
      );
    });
    await batch.commit();
  }
}

export async function clearCloudLearningData(uid, certificateId = "") {
  if (!db || !uid) return;
  const collectionNames = ["cbtProgress", "cbtPracticeProgress", "cbtAttempts"];
  const snapshots = await Promise.all(collectionNames.map((name) => getDocs(collection(db, "users", uid, name))));
  const deleteRefs = snapshots.flatMap((snapshot) => snapshot.docs)
    .filter((item) => !certificateId || item.data()?.certificateId === certificateId)
    .map((item) => item.ref);
  await deleteDocumentRefs(deleteRefs);
}
