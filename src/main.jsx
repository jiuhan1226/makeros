import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { auth, firebaseConfigured, getExamQuestions, isAdminUser, listCertificates, listExams, loadCloudState, onAuthStateChanged, saveCloudState } from "./firebase";
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
import { buildWrongNoteAnalysis, shuffle } from "./utils/exam";
import { useExamSession } from "./hooks/useExamSession";
import { assetId, readPdfLibrary, readStudyAssets, saveStudyAssets } from "./utils/studyPlatform";
import { createBuildProject as makeBuildProject, readMakerState, saveMakerState } from "./utils/makerPlatform";
import { generateStudyAssetsFromPages } from "./utils/aiStudyAssets";
import "./styles.css";

const LOCAL_KEY="studylock-v3-state";
const LEGACY_PDF_KEY="studylock-v1.5-state";
function readLocal(){try{return JSON.parse(localStorage.getItem(LOCAL_KEY)||"{}");}catch{return{};}}
function readLegacyPdf(){try{return JSON.parse(localStorage.getItem(LEGACY_PDF_KEY)||"{}");}catch{return{};}}

function App() {
  const initial=useRef(readLocal()).current;
  const makerInitial=useRef(readMakerState()).current;
  const [page,setPage]=useState("makerHome"),[certificates,setCertificates]=useState([]),[certificate,setCertificate]=useState(null),[exams,setExams]=useState([]),[selectedExam,setSelectedExam]=useState(null),[user,setUser]=useState(null),[showAuth,setShowAuth]=useState(false);
  const [history,setHistory]=useState(initial.history||[]),[wrongNotes,setWrongNotes]=useState(initial.wrongNotes||[]),[studyEvents,setStudyEvents]=useState(initial.studyEvents||[]),[plan,setPlan]=useState(initial.plan||{}),[questionBookmarks,setQuestionBookmarks]=useState(initial.questionBookmarks||[]);
  const [pdfQuizHistory,setPdfQuizHistory]=useState(initial.pdfQuizHistory||[]),[pdfQuizWrongNotes,setPdfQuizWrongNotes]=useState(initial.pdfQuizWrongNotes||[]);
  const [graphQuery,setGraphQuery]=useState("");
  const [tutorSeed,setTutorSeed]=useState({question:"",pdfId:""});
  const [assetFocus,setAssetFocus]=useState(null);
  const [pdfLibrary,setPdfLibrary]=useState(readPdfLibrary()),[assets,setAssets]=useState(readStudyAssets()),[assetBusy,setAssetBusy]=useState(false);
  const [cloudReady,setCloudReady]=useState(false);
  const [inventorProjects,setInventorProjects]=useState(makerInitial.inventorProjects||[]),[buildProjects,setBuildProjects]=useState(makerInitial.buildProjects||[]),[portfolioItems,setPortfolioItems]=useState(makerInitial.portfolioItems||[]),[awards,setAwards]=useState(makerInitial.awards||[]),[certifications,setCertifications]=useState(makerInitial.certifications||[]),[resumeProfile,setResumeProfile]=useState(makerInitial.resumeProfile||{}),[careerProfile,setCareerProfile]=useState(makerInitial.careerProfile||{});
  const session=useExamSession();

  useEffect(()=>firebaseConfigured?onAuthStateChanged(auth,setUser):undefined,[]);
  useEffect(()=>{listCertificates().then(setCertificates).catch(console.error)},[]);
  useEffect(()=>{if(certificate)listExams(certificate.id).then(setExams).catch(console.error)},[certificate]);
  useEffect(()=>{const sync=()=>{setPdfLibrary(readPdfLibrary());setAssets(readStudyAssets());};window.addEventListener("studylock:pdf-library",sync);window.addEventListener("studylock:study-assets",sync);window.addEventListener("storage",sync);return()=>{window.removeEventListener("studylock:pdf-library",sync);window.removeEventListener("studylock:study-assets",sync);window.removeEventListener("storage",sync);}},[]);
  useEffect(()=>{if(!user){setCloudReady(true);return;} setCloudReady(false);loadCloudState(user.uid).then(data=>{if(data){setHistory(data.history||[]);setWrongNotes(data.wrongNotes||[]);setStudyEvents(data.studyEvents||[]);setPlan(data.plan||{});setQuestionBookmarks(data.questionBookmarks||[]);}setCloudReady(true)}).catch(()=>setCloudReady(true));},[user]);
  useEffect(()=>{const state={history,wrongNotes,studyEvents,plan,questionBookmarks,pdfQuizHistory,pdfQuizWrongNotes};localStorage.setItem(LOCAL_KEY,JSON.stringify(state));if(user&&cloudReady){const cloudState={history,wrongNotes,studyEvents,plan,questionBookmarks};const id=setTimeout(()=>saveCloudState(user.uid,cloudState).catch(console.error),500);return()=>clearTimeout(id)}},[history,wrongNotes,studyEvents,plan,questionBookmarks,pdfQuizHistory,pdfQuizWrongNotes,user,cloudReady]);
  useEffect(()=>{saveMakerState({inventorProjects,buildProjects,portfolioItems,awards,certifications,resumeProfile,careerProfile});},[inventorProjects,buildProjects,portfolioItems,awards,certifications,resumeProfile,careerProfile]);

  const active=useMemo(()=>page==="mode"?"past":page==="exam"?(session.exam?.sourceType==="pdf"?"pdfstudy":"past"):page,[page,session.exam?.sourceType]);
  const legacyPdf=readLegacyPdf();
  const pdfStats=legacyPdf.stats||{sessions:0,solved:0,correct:0,studySeconds:0};
  const pdfWrongNotes=(legacyPdf.wrongNotes||[]).filter(q=>!q.examId);
  const activeBookmarks=useMemo(()=>session.questions.filter((q,i)=>session.bookmarks[i]),[session.questions,session.bookmarks]);
  const savedBookmarks=useMemo(()=>[...activeBookmarks,...questionBookmarks].filter((q,i,a)=>a.findIndex(x=>x.id===q.id)===i),[activeBookmarks,questionBookmarks]);

  const certificateExamIds=useMemo(()=>new Set(exams.map(e=>e.id)),[exams]);
  const certificateHistory=useMemo(()=>history.filter(h=>h.certificateId? h.certificateId===certificate?.id : certificateExamIds.has(h.examId)),[history,certificate?.id,certificateExamIds]);
  const certificateWrongNotes=useMemo(()=>wrongNotes.filter(q=>q.certificateId? q.certificateId===certificate?.id : certificateExamIds.has(q.examId)),[wrongNotes,certificate?.id,certificateExamIds]);
  const certificateStudyEvents=useMemo(()=>studyEvents.filter(e=>e.certificateId? e.certificateId===certificate?.id : certificateExamIds.has(e.examId)),[studyEvents,certificate?.id,certificateExamIds]);

  async function selectCertificate(cert){setCertificate(cert);setPage("certificate")}
  async function openExam(exam){setSelectedExam(exam);setPage("mode")}
  async function startExam(mode){const questions=await getExamQuestions(selectedExam.id);session.start(selectedExam,questions,mode);setPage("exam")}
  function recordFinishedSession(){
    if(!session.submitted||!session.questions.length)return;
    const result=session.result,now=Date.now();
    const isPdf=session.exam?.sourceType==="pdf"||session.exam?.assessmentType==="practice";
    const wrong=session.questions.map((q,i)=>({...q,selectedAnswerIndex:session.answers[i],examTitle:session.exam?.title||"학습",examId:session.exam?.id||"",createdAt:now})).filter(q=>q.selectedAnswerIndex!==q.answerIndex);
    if(isPdf){
      const pdfId=session.exam?.pdfId||"";
      const sourceName=session.exam?.sourceName||session.exam?.title||"PDF 학습";
      setPdfQuizHistory(prev=>[{title:session.exam?.title||"PDF 이해도 확인",examId:session.exam?.id||"",pdfId,sourceName,mode:session.mode,score:result.score,total:result.total,correct:result.correct,resultLabel:"학습 완료",subjects:result.subjects,createdAt:now},...prev].slice(0,300));
      setPdfQuizWrongNotes(prev=>[...wrong.map(q=>({...q,pdfId,sourceName,sourceType:"PDF"})),...prev].slice(0,1500));
      return;
    }
    const certificateId=session.exam?.certificateId||certificate?.id||"";
    const certificateName=session.exam?.certificateName||certificate?.name||"";
    setHistory(prev=>[{title:session.exam?.title||"시험",examId:session.exam?.id||"",certificateId,certificateName,mode:session.mode,score:result.score,total:result.total,correct:result.correct,passed:result.passed,resultLabel:result.resultLabel,subjects:result.subjects,createdAt:now},...prev].slice(0,300));
    setWrongNotes(prev=>[...wrong.map(q=>({...q,certificateId,certificateName})),...prev].slice(0,1500));
    setStudyEvents(prev=>[{type:"exam",examId:session.exam?.id||"",certificateId,certificateName,questionCount:session.questions.length,durationSeconds:session.elapsedSeconds,createdAt:now},...prev].slice(0,1000));
    const bookmarked=session.questions.filter((q,i)=>session.bookmarks[i]).map(q=>({...q,examTitle:session.exam?.title||"시험",savedAt:now}));
    if(bookmarked.length)setQuestionBookmarks(prev=>[...bookmarked,...prev].filter((q,i,a)=>a.findIndex(x=>x.id===q.id)===i).slice(0,1000));
  }
  function finishExam(){const next=session.exam?.sourceType==="pdf"?"pdfstudy":"past";recordFinishedSession();setPage(next)}
  function navigate(next){if(!certificate&&["certificate","past","subject","topic","mock","bookmark","search","planner","learning","report"].includes(next))return setPage("catalog");if(next==="graph")setGraphQuery("");if(next==="notes")setAssetFocus(null);if(next==="tutor"&&page!=="pdfstudy")setTutorSeed({question:"",pdfId:""});setPage(next)}
  function createBuildProject(invent){
    const exists=buildProjects.find(item=>item.sourceInventId===invent.id);
    if(exists){setPage("projects");return;}
    const now=Date.now();
    const project=makeBuildProject({sourceInventId:invent.id,title:invent.rightsDraft?.title||invent.title,problem:invent.rightsDraft?.problem||invent.problem?.inconvenience||"",solution:invent.solution?.concept||"",status:"active",tasks:[{id:`task-${now}-1`,title:"요구사항과 성공 기준 정리",done:false},{id:`task-${now}-2`,title:"핵심 기능 또는 구조 프로토타입 제작",done:false},{id:`task-${now}-3`,title:"사용자 테스트 및 개선점 기록",done:false},{id:`task-${now}-4`,title:"발표 자료와 결과 보고서 정리",done:false}],journals:[]});
    setBuildProjects([project,...buildProjects]);setPage("projects");
  }
  async function allQuestionBatches(){return Promise.all(exams.map(async exam=>({exam,questions:await getExamQuestions(exam.id)})))}
  async function searchQuestions(keyword){const term=keyword.toLowerCase();const batches=await allQuestionBatches();return batches.flatMap(b=>b.questions.map(q=>({exam:b.exam,q}))).filter(({q})=>[q.question,...(q.choices||[]),q.explanation,q.subject,q.topic,q.chapter,q.unit].join(" ").toLowerCase().includes(term)).slice(0,150)}
  function openSearchResult(exam,q){const pseudo={...(exam||{}),id:`search-${q.id}`,title:`검색 학습 · ${q.subject||"문제"}`,durationMinutes:5,hasSubjectCutoff:false};session.start(pseudo,[q],"연습모드");setPage("exam")}
  function startWrongReview(items){const questions=(items||[]).map((q,i)=>({...q,questionNumber:i+1}));if(!questions.length)return;session.start({id:`wrong-review-${Date.now()}`,title:"CBT 오답 다시 풀기",durationMinutes:questions.length,hasSubjectCutoff:false},questions,"연습모드");setPage("exam");}
  async function startRecommended(subject,count=20){const batches=await allQuestionBatches();const pool=batches.flatMap(b=>b.questions).filter(q=>subject==="전체 과목"||q.subject===subject);if(!pool.length){alert("추천 문제를 만들 수 있는 기출문제가 없습니다.");return;}const questions=shuffle(pool).slice(0,Math.min(count,pool.length));session.start({id:`recommended-${Date.now()}`,title:`AI 추천 · ${subject}`,durationMinutes:questions.length,hasSubjectCutoff:false},questions,"연습모드");setPage("exam")}
  function openPdf(doc,pageNumber=1){if(doc)localStorage.setItem("studylock-open-pdf",JSON.stringify({id:doc.id,page:pageNumber}));setPage("pdfstudy");}
  function startPdfQuiz(questions,meta){const normalized=(questions||[]).map((q,i)=>({...q,id:q.id||`pdf-q-${Date.now()}-${i}`,questionNumber:q.questionNumber||i+1,subject:q.subject||"PDF 이해도 확인",sourceName:meta?.name||"PDF",sourceType:"PDF",pdfId:meta?.pdfId||""}));if(!normalized.length)return;session.start({id:`pdf-${Date.now()}`,title:`${meta?.name||"PDF"} · 이해도 확인`,durationMinutes:normalized.length,hasSubjectCutoff:false,assessmentType:"practice",sourceType:"pdf",pdfId:meta?.pdfId||"",sourceName:meta?.name||"PDF"},normalized,"연습모드");setPage("exam");}
  function openTutorWithPdf(name){const doc=pdfLibrary.find(item=>String(item.name||"").replace(/\.pdf$/i,"").trim()===String(name||"").replace(/\.pdf$/i,"").trim())||pdfLibrary.find(item=>item.name===name);setTutorSeed({question:"",pdfId:doc?.id||""});setPage("tutor");}
  async function createAssetsFromPdf(doc){
    if(!doc?.pages?.length){alert("이 PDF는 텍스트가 저장되지 않아 AI 자료를 만들 수 없습니다. PDF를 다시 업로드해 주세요.");return;}
    setAssetBusy(true);
    try{
      const created=await generateStudyAssetsFromPages({pages:doc.pages,sourceName:doc.name,pdfId:doc.id});
      const same=(item)=>item.pdfId===doc.id||String(item.sourceName||"").replace(/\.pdf$/i,"").trim().toLowerCase()===String(doc.name||"").replace(/\.pdf$/i,"").trim().toLowerCase();
      const next={notes:[...created.notes,...(assets.notes||[]).filter(item=>!same(item))],cards:[...created.cards,...(assets.cards||[]).filter(item=>!same(item))]};
      saveStudyAssets(next);setAssets(next);setPage("notes");
    }catch(e){alert(e.message)}finally{setAssetBusy(false)}
  }
  async function createAssetsFromWrong(){if(!wrongNotes.length){alert("CBT 오답이 없습니다.");return;}setAssetBusy(true);try{const source=wrongNotes.slice(0,40).map((q,i)=>`${i+1}. [${q.subject||"공통"}] ${q.question}\n정답: ${(q.choices||[])[q.answerIndex]||q.answerIndex}\n해설: ${q.explanation||""}`).join("\n\n").slice(0,18000);const r=await fetch("/api/generate-study-assets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source,sourceName:`${certificate?.name||"자격증"} CBT 오답`})});const j=await r.json();if(!r.ok)throw Error(j.error||"생성 실패");const sourceName=`${certificate?.name||"자격증"} CBT 오답`;const next={notes:[...(j.notes||[]).map(n=>({...n,id:assetId("note"),sourceName,sourceType:"CBT 오답",folderId:`cbt:${certificate?.id||"general"}`,certificateId:certificate?.id||"",certificateName:certificate?.name||"자격증",createdAt:Date.now()})),...(assets.notes||[])],cards:[...(j.cards||[]).map(c=>({...c,id:assetId("card"),sourceName,sourceType:"CBT 오답",folderId:`cbt:${certificate?.id||"general"}`,certificateId:certificate?.id||"",certificateName:certificate?.name||"자격증",createdAt:Date.now()})),...(assets.cards||[])]};saveStudyAssets(next);setAssets(next);}catch(e){alert(e.message)}finally{setAssetBusy(false)}}
  function deleteAsset(type,id){const next={...assets,[type]:(assets[type]||[]).filter(x=>x.id!==id)};saveStudyAssets(next);setAssets(next)}
  function openStudyAsset(type,item){if(!item?.id)return;setAssetFocus({type,id:item.id,openedAt:Date.now()});setPage("notes");}

  return <div className="app"><AppHeader active={active} onNavigate={navigate} certificateName={certificate?.name} user={user} onLogin={()=>setShowAuth(true)} isAdmin={isAdminUser(user)}/>
    {page==="makerHome"&&<MakerHomePage onNavigate={navigate} history={history} wrongNotes={wrongNotes} pdfLibrary={pdfLibrary} assets={assets} inventorProjects={inventorProjects} buildProjects={buildProjects}/>}
    {page==="invent"&&<InventPage projects={inventorProjects} onChangeProjects={setInventorProjects} onCreateBuildProject={createBuildProject}/>}
    {page==="projects"&&<ProjectsPage projects={buildProjects} inventorProjects={inventorProjects} onChangeProjects={setBuildProjects} onOpenInvent={()=>setPage("invent")}/>}
    {page==="portfolio"&&<PortfolioPage inventorProjects={inventorProjects} buildProjects={buildProjects} history={history} assets={assets} resumeProfile={resumeProfile} onChangeResumeProfile={setResumeProfile} awards={awards} onChangeAwards={setAwards} certifications={certifications} onChangeCertifications={setCertifications} portfolioItems={portfolioItems} onChangePortfolioItems={setPortfolioItems}/>}
    {page==="career"&&<CareerPage assets={assets} inventorProjects={inventorProjects} buildProjects={buildProjects} pdfLibrary={pdfLibrary} history={history} awards={awards} certifications={certifications} onNavigate={navigate}/>}
    {page==="catalog"&&<CatalogPage certificates={certificates} onSelect={selectCertificate} history={history} wrongNotes={wrongNotes} pdfLibrary={pdfLibrary} onNavigate={navigate}/>} 
    {page==="certificate"&&<CertificateHomePage certificate={certificate} exams={exams} history={certificateHistory} wrongNotes={certificateWrongNotes} plan={plan} onNavigate={navigate} onOpenExam={openExam} loadQuestions={getExamQuestions}/>} 
    {page==="learning"&&<LearningCenterPage certificate={certificate} history={certificateHistory} wrongNotes={certificateWrongNotes} onStartRecommended={startRecommended} onNavigate={navigate}/>} 
    {page==="knowledge"&&<UnifiedSearchPage searchCbt={searchQuestions} pdfLibrary={pdfLibrary} wrongNotes={[...wrongNotes,...pdfWrongNotes]} bookmarks={savedBookmarks} notes={assets.notes} cards={assets.cards} onOpenCbt={openSearchResult} onOpenPdf={openPdf}/>} 
    {page==="library"&&<PdfLibraryPage library={pdfLibrary} onRefresh={()=>setPdfLibrary(readPdfLibrary())} onOpen={openPdf} onCreateAssets={createAssetsFromPdf}/>} 
    {page==="pdfstudy"&&<PdfStudyPage library={pdfLibrary} onRefresh={()=>setPdfLibrary(readPdfLibrary())} onStartQuiz={startPdfQuiz} onOpenTutor={openTutorWithPdf}/>} 
    {page==="notes"&&<NotesCardsPage assets={assets} onDelete={deleteAsset} onGenerateFromWrong={createAssetsFromWrong} busy={assetBusy} initialFocus={assetFocus}/>} 
    {page==="report"&&<GrowthReportPage certificate={certificate} history={certificateHistory} studyEvents={certificateStudyEvents} wrongNotes={certificateWrongNotes}/>} 
    {page==="tutor"&&<AiTutorPage certificate={certificate} initialQuery={tutorSeed.question} initialPdfId={tutorSeed.pdfId} wrongNotes={wrongNotes} pdfLibrary={pdfLibrary} assets={assets} searchCbt={searchQuestions} onOpenCbt={openSearchResult} onOpenPdf={openPdf} onOpenGraph={(q)=>{setGraphQuery(q);setPage("graph")}}/>}
    {page==="graph"&&<KnowledgeGraphPage initialQuery={graphQuery} wrongNotes={wrongNotes} pdfLibrary={pdfLibrary} assets={assets} searchCbt={searchQuestions} onOpenCbt={openSearchResult} onOpenPdf={openPdf} onOpenAsset={openStudyAsset} onAskTutor={(payload)=>{const value=typeof payload==="string"?{question:payload,pdfId:""}:payload||{question:"",pdfId:""};setTutorSeed(value);setPage("tutor")}}/>} 
    {page==="past"&&<PastExamsPage exams={exams} loadQuestions={getExamQuestions} onOpen={openExam} onNavigate={navigate}/>} 
    {page==="subject"&&<SubjectStudyPage certificate={certificate} exams={exams} history={certificateHistory} loadQuestions={getExamQuestions} onStart={(questions,exam)=>{session.start(exam,questions,"연습모드");setPage("exam")}} onNavigate={navigate}/>} 
    {page==="topic"&&<TopicStudyPage exams={exams} loadQuestions={getExamQuestions} onStart={(questions,exam)=>{session.start(exam,questions,"연습모드");setPage("exam")}} onNavigate={navigate}/>} 
    {page==="mode"&&<ModeSelectPage exam={selectedExam} onStart={startExam} onBack={()=>setPage("past")}/>} 
    {page==="exam"&&<ExamPage session={session} onExit={finishExam}/>} 
    {page==="mock"&&<MockExamPage exams={exams} loadQuestions={getExamQuestions} onStart={(questions,exam)=>{session.start(exam,questions,"실전모드");setPage("exam")}}/>} 
    {page==="bookmark"&&<BookmarkPage wrongNotes={certificateWrongNotes} certificateName={certificate?.name} history={certificateHistory} onStartRecommended={startRecommended} onStartWrongReview={startWrongReview}/>} 
    {page==="search"&&<SearchPage exams={exams} searchQuestions={async term=>(await searchQuestions(term)).map(x=>x.q)} onOpenResult={(exam,q)=>openSearchResult(exam,q)}/>} 
    {page==="stats"&&<StudyStatsPage history={history} studyEvents={studyEvents}/>} 
    {page==="planner"&&<PlannerPage certificate={certificate} wrongNotes={wrongNotes} history={history} plan={plan} onSavePlan={setPlan} onStartRecommended={startRecommended} pdfLibrary={pdfLibrary}/>} 
    {page==="admin"&&isAdminUser(user)&&<AdminPage/>}
    {showAuth&&<AuthModal user={user} onClose={()=>setShowAuth(false)}/>}<div className="sync-indicator">{assetBusy?"AI 자료 생성 중…":user?(cloudReady?"클라우드 동기화":"동기화 중…"):"이 기기에 자동 저장"}</div>
  </div>;
}
createRoot(document.getElementById("root")).render(<React.StrictMode><App/></React.StrictMode>);
