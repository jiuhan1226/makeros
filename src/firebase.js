import { initializeApp } from "firebase/app";
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signInWithPopup, signOut
} from "firebase/auth";
import {
  collection, deleteDoc, doc, getDoc, getDocs, getFirestore, limit, orderBy,
  query, serverTimestamp, setDoc, where, writeBatch
} from "firebase/firestore";
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
export async function saveExam(data){ if(!db)throw new Error("Firebase 설정이 필요합니다."); await setDoc(doc(db,"cbtExams",data.id),{...data,updatedAt:serverTimestamp()},{merge:true}); }
export async function deleteExam(examId){ if(!db)return; const qs=await getDocs(query(collection(db,"cbtQuestions"),where("examId","==",examId))); const chunks=[]; for(let i=0;i<qs.docs.length;i+=400)chunks.push(qs.docs.slice(i,i+400)); for(const part of chunks){const b=writeBatch(db);part.forEach(x=>b.delete(x.ref));await b.commit();} await deleteDoc(doc(db,"cbtExams",examId)); }
export async function getExamQuestions(examId){ if(!db)return[]; const s=await getDocs(query(collection(db,"cbtQuestions"),where("examId","==",examId))); return s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.questionNumber-b.questionNumber); }
export async function importExamQuestions(exam, questions){
  if(!db)throw new Error("Firebase 설정이 필요합니다.");
  const normalized=questions.map((q,i)=>({
    id:q.id||`${exam.id}_${String(q.questionNumber??i+1).padStart(3,"0")}`,
    examId:exam.id, certificateId:exam.certificateId, certificateName:exam.certificateName,
    grade:exam.grade, year:Number(exam.year), round:String(exam.round),
    questionNumber:Number(q.questionNumber??i+1), subject:String(q.subject||"공통").trim(),
    question:String(q.question||"").trim(), choices:(q.choices||[]).map(v=>String(v).trim()),
    answerIndex:Number(q.answerIndex), explanation:String(q.explanation||"").trim(),
    imageUrl:String(q.imageUrl||"").trim(), questionImageUrls:(q.questionImageUrls||[]).map(v=>String(v).trim()).filter(Boolean), choiceImageUrls:(q.choiceImageUrls||[]).map(v=>String(v||"").trim()), sourceName:String(q.sourceName||exam.sourceName||"").trim(),
    sourceUrl:String(q.sourceUrl||exam.sourceUrl||"").trim(), sourcePage:Number(q.sourcePage||0), needsReview:Boolean(q.needsReview), examDate:String(q.examDate||exam.examDate||"").trim(), updatedAt:serverTimestamp()
  }));
  const chunks=[];for(let i=0;i<normalized.length;i+=400)chunks.push(normalized.slice(i,i+400));
  for(const part of chunks){const b=writeBatch(db);part.forEach(q=>b.set(doc(db,"cbtQuestions",q.id),q,{merge:true}));await b.commit();}
  await saveExam({...exam,questionCount:normalized.length}); return normalized.length;
}

export async function uploadCbtImage(blob,path,contentType="image/png"){ if(!storage)throw new Error("Firebase Storage 설정이 필요합니다."); const target=ref(storage,path); await uploadBytes(target,blob,{contentType}); return getDownloadURL(target); }
