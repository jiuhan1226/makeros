import { initializeApp } from "firebase/app";
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signInWithPopup, signOut
} from "firebase/auth";
import {
  collection, deleteDoc, doc, getDoc, getDocs, getFirestore, limit, orderBy,
  query, serverTimestamp, setDoc, Timestamp, where, writeBatch
} from "firebase/firestore";
function calculateNextReviewDate({
  isCorrect,
  confidence,
  reviewLevel = 0,
}) {
  let days = 1;

  if (!isCorrect) {
    days = confidence === "medium" ? 2 : 1;
  } else if (confidence === "low") {
    days = 1;
  } else if (confidence === "medium") {
    days = 3;
  } else if (reviewLevel >= 3) {
    days = 30;
  } else if (reviewLevel >= 2) {
    days = 14;
  } else {
    days = 7;
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + days);

  return Timestamp.fromDate(nextDate);
}

export async function saveQuestionProgress({
  uid,
  question,
  exam,
  selectedAnswerIndex,
  isCorrect,
  confidence,
}) {
  if (!db) {
    throw new Error("Firebase 설정이 필요합니다.");
  }

  if (!uid) {
    throw new Error("로그인이 필요합니다.");
  }

  if (!question?.id) {
    throw new Error("문제 ID가 없습니다.");
  }

  if (!["high", "medium", "low"].includes(confidence)) {
    throw new Error("자기평가 값이 올바르지 않습니다.");
  }

  const progressRef = doc(
    db,
    "users",
    uid,
    "cbtProgress",
    question.id
  );

  const progressSnapshot = await getDoc(progressRef);

  const previous = progressSnapshot.exists()
    ? progressSnapshot.data()
    : {};

  const attemptCount =
    Number(previous.attemptCount || 0) + 1;

  const correctCount =
    Number(previous.correctCount || 0) +
    (isCorrect ? 1 : 0);

  const wrongCount =
    Number(previous.wrongCount || 0) +
    (isCorrect ? 0 : 1);

  let reviewLevel = Number(previous.reviewLevel || 0);

  if (isCorrect && confidence === "high") {
    reviewLevel += 1;
  } else if (!isCorrect || confidence === "low") {
    reviewLevel = 0;
  }

  const progressData = {
    questionId: question.id,
    examId: exam.id,
    certificateId: exam.certificateId,
    certificateName: exam.certificateName || "",
    subject: String(question.subject || "공통").trim(),

    attemptCount,
    correctCount,
    wrongCount,

    lastAnswerIndex: Number(selectedAnswerIndex),
    correctAnswerIndex: Number(question.answerIndex),
    isCorrect: Boolean(isCorrect),

    confidence,
    reviewLevel,

    nextReviewAt: calculateNextReviewDate({
      isCorrect,
      confidence,
      reviewLevel,
    }),

    lastSolvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(progressRef, progressData, {
    merge: true,
  });

  return progressData;
}
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);
const adminUids = String(import.meta.env.VITE_ADMIN_UIDS || "").split(",").map(v => v.trim()).filter(Boolean);
let app = null; let auth = null; let db = null; let storage = null;
if (firebaseConfigured) { app = initializeApp(firebaseConfig); auth = getAuth(app); db = getFirestore(app); storage = getStorage(app); }
export { auth, db, storage, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut };
export const isAdminUser = user => !!user && adminUids.includes(user.uid);
export async function signInGoogle(){ if(!auth) throw new Error("Firebase 설정이 필요합니다."); return signInWithPopup(auth,new GoogleAuthProvider()); }

export async function loadCloudState(uid){ if(!db)return null; const s=await getDoc(doc(db,"users",uid,"studylock","state")); return s.exists()?s.data():null; }
export async function saveCloudState(uid,state){ if(!db)return; await setDoc(doc(db,"users",uid,"studylock","state"),{...state,updatedAt:serverTimestamp()},{merge:true}); }

export async function listCertificates(){ if(!db)return[]; const s=await getDocs(query(collection(db,"certificates"),orderBy("name"))); return s.docs.map(d=>({id:d.id,...d.data()})); }
export async function saveCertificate(data){ if(!db)throw new Error("Firebase 설정이 필요합니다."); const id=data.id.trim(); await setDoc(doc(db,"certificates",id),{...data,id,updatedAt:serverTimestamp()},{merge:true}); }
export async function listExams(certificateId=null, publishedOnly=true){ if(!db)return[]; let q=certificateId?query(collection(db,"cbtExams"),where("certificateId","==",certificateId)):query(collection(db,"cbtExams")); const s=await getDocs(q); return s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>!publishedOnly||x.status==="published").sort((a,b)=>(b.year-a.year)||String(b.round).localeCompare(String(a.round),"ko")); }
function sanitizeDocumentId(value) {
  return String(value ?? "")
    .trim()
    .replace(/\//g, "-")
    .replace(/\s+/g, "_");
}

export function createExamId(exam) {
  const certificateId = sanitizeDocumentId(exam.certificateId);
  const year = sanitizeDocumentId(exam.year);
  const round = sanitizeDocumentId(exam.round);

  if (!certificateId || !year || !round) {
    throw new Error("자격증, 연도, 회차를 모두 입력해 주세요.");
  }

  return `${certificateId}_${year}_${round}`;
}

export async function saveExam(data) {
  if (!db) {
    throw new Error("Firebase 설정이 필요합니다.");
  }

  const examId = createExamId(data);

  const normalizedExam = {
    ...data,

    // 문서 ID와 내부 id 필드를 동일하게 유지
    id: examId,

    year: Number(data.year),
    round: String(data.round ?? "").trim(),
    examDate: String(data.examDate ?? "").trim(),
    durationMinutes: Number(data.durationMinutes) || 60,
    passScore: Number(data.passScore) || 60,

    updatedAt: serverTimestamp(),
  };

  await setDoc(
    doc(db, "cbtExams", examId),
    normalizedExam,
    { merge: true }
  );

  return normalizedExam;
}
export async function deleteExam(examId){ if(!db)return; const qs=await getDocs(query(collection(db,"cbtQuestions"),where("examId","==",examId))); const chunks=[]; for(let i=0;i<qs.docs.length;i+=400)chunks.push(qs.docs.slice(i,i+400)); for(const part of chunks){const b=writeBatch(db);part.forEach(x=>b.delete(x.ref));await b.commit();} await deleteDoc(doc(db,"cbtExams",examId)); }
export async function getExamQuestions(examId){ if(!db)return[]; const s=await getDocs(query(collection(db,"cbtQuestions"),where("examId","==",examId))); return s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.questionNumber-b.questionNumber); }
export async function importExamQuestions(exam, questions) {
  if (!db) {
    throw new Error("Firebase 설정이 필요합니다.");
  }

  // 입력한 연도·회차를 기준으로 시험 ID를 다시 생성
  const examId = createExamId(exam);

  const normalizedExam = {
    ...exam,
    id: examId,
    year: Number(exam.year),
    round: String(exam.round || "").trim(),
    examDate: String(exam.examDate || "").trim(),
  };

  const normalized = questions.map((q, index) => {
    const questionNumber = Number(q.questionNumber ?? index + 1);

    return {
      // 기존 AI id를 사용하지 않고 현재 시험 ID로 통일
      id: `${examId}_${String(questionNumber).padStart(3, "0")}`,

      examId,
      certificateId: normalizedExam.certificateId,
      certificateName: normalizedExam.certificateName,
      grade: normalizedExam.grade,

      // 연도와 회차는 화면 입력값만 사용
      year: normalizedExam.year,
      round: normalizedExam.round,

      questionNumber,
      subject: String(q.subject || "공통").trim(),
      question: String(q.question || "").trim(),

      choices: (q.choices || []).map((value) =>
        String(value).trim()
      ),

      answerIndex: Number(q.answerIndex),
      explanation: String(q.explanation || "").trim(),

      imageUrl: String(q.imageUrl || "").trim(),

      questionImageUrls: (q.questionImageUrls || [])
        .map((value) => String(value).trim())
        .filter(Boolean),

      choiceImageUrls: (q.choiceImageUrls || []).map((value) =>
        String(value || "").trim()
      ),

      sourceName: String(
        normalizedExam.sourceName || q.sourceName || ""
      ).trim(),

      sourceUrl: String(
        normalizedExam.sourceUrl || q.sourceUrl || ""
      ).trim(),

      sourcePage: Number(q.sourcePage || 0),
      needsReview: Boolean(q.needsReview),

      // AI 추출값이 아니라 화면에서 입력한 시험 날짜 사용
      examDate: normalizedExam.examDate,

      updatedAt: serverTimestamp(),
    };
  });

  const chunks = [];

  for (let index = 0; index < normalized.length; index += 400) {
    chunks.push(normalized.slice(index, index + 400));
  }

  for (const part of chunks) {
    const batch = writeBatch(db);

    part.forEach((question) => {
      batch.set(
        doc(db, "cbtQuestions", question.id),
        question,
        { merge: true }
      );
    });

    await batch.commit();
  }

  await saveExam({
    ...normalizedExam,
    questionCount: normalized.length,
  });

  return normalized.length;
}

export async function uploadCbtImage(blob,path,contentType="image/png"){ if(!storage)throw new Error("Firebase Storage 설정이 필요합니다."); const target=ref(storage,path); await uploadBytes(target,blob,{contentType}); return getDownloadURL(target); }

function calculateNextReviewDate({
  isCorrect,
  confidence,
  reviewLevel = 0,
}) {
  let days = 1;

  if (!isCorrect) {
    days = confidence === "medium" ? 2 : 1;
  } else if (confidence === "low") {
    days = 1;
  } else if (confidence === "medium") {
    days = 3;
  } else {
    if (reviewLevel >= 3) {
      days = 30;
    } else if (reviewLevel >= 2) {
      days = 14;
    } else {
      days = 7;
    }
  }

  const date = new Date();
  date.setDate(date.getDate() + days);

  return Timestamp.fromDate(date);
}

export async function saveQuestionProgress({
  uid,
  question,
  exam,
  selectedAnswerIndex,
  isCorrect,
  confidence,
}) {
  if (!db) {
    throw new Error("Firebase 설정이 필요합니다.");
  }

  if (!uid) {
    throw new Error("로그인이 필요합니다.");
  }

  if (!question?.id) {
    throw new Error("문제 정보가 없습니다.");
  }

  const progressRef = doc(
    db,
    "users",
    uid,
    "cbtProgress",
    question.id
  );

  const progressSnapshot = await getDoc(progressRef);
  const previous = progressSnapshot.exists()
    ? progressSnapshot.data()
    : {};

  const previousAttemptCount = Number(previous.attemptCount || 0);
  const previousCorrectCount = Number(previous.correctCount || 0);
  const previousWrongCount = Number(previous.wrongCount || 0);
  const previousReviewLevel = Number(previous.reviewLevel || 0);

  let reviewLevel = previousReviewLevel;

  if (isCorrect && confidence === "high") {
    reviewLevel += 1;
  } else if (!isCorrect || confidence === "low") {
    reviewLevel = 0;
  }

  const nextReviewAt = calculateNextReviewDate({
    isCorrect,
    confidence,
    reviewLevel,
  });

  const progressData = {
    questionId: question.id,
    examId: exam.id,
    certificateId: exam.certificateId,

    subject: String(question.subject || "공통").trim(),

    attemptCount: previousAttemptCount + 1,
    correctCount: previousCorrectCount + (isCorrect ? 1 : 0),
    wrongCount: previousWrongCount + (isCorrect ? 0 : 1),

    lastAnswerIndex: Number(selectedAnswerIndex),
    correctAnswerIndex: Number(question.answerIndex),
    isCorrect: Boolean(isCorrect),

    confidence,
    reviewLevel,
    nextReviewAt,

    lastSolvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(progressRef, progressData, {
    merge: true,
  });

  return progressData;
}

export async function getTodayReviewProgress(uid) {
  if (!db || !uid) {
    return [];
  }

  const now = Timestamp.now();

  const snapshot = await getDocs(
    query(
      collection(db, "users", uid, "cbtProgress"),
      where("nextReviewAt", "<=", now),
      orderBy("nextReviewAt")
    )
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function getRepeatedWrongProgress(uid) {
  if (!db || !uid) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, "users", uid, "cbtProgress"),
      where("wrongCount", ">=", 2),
      orderBy("wrongCount", "desc")
    )
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}
