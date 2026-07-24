import { useMemo } from "react";
import { buildWrongNoteAnalysis } from "../utils/exam";

export default function LearningCenterPage({ certificate, history=[], wrongNotes=[], onStartRecommended, onNavigate }){
 const analysis=useMemo(()=>buildWrongNoteAnalysis(wrongNotes,history),[wrongNotes,history]);
 const top=analysis.weakSubjects[0]?.subject||"전체 과목";
 const solved=history.reduce((s,h)=>s+(h.total||0),0);
 const correct=history.reduce((s,h)=>s+(h.correct||0),0);
 const accuracy=solved?Math.round(correct/solved*100):0;
 const latest=history[0];
 return <main className="page-shell">
  <section className="page-title"><div><span className="eyebrow">CBT AI LEARNING CENTER</span><h1>{certificate?.name} AI 학습센터</h1><p>선택한 자격증의 CBT 풀이 기록과 오답만 분석해 다음 학습을 추천합니다.</p></div><button className="primary" onClick={()=>onStartRecommended(top,20)}>오늘 추천 20문제</button></section>
  <section className="stats-grid"><article className="stat-card"><span>CBT 총 풀이</span><strong>{solved}문제</strong></article><article className="stat-card"><span>CBT 정답률</span><strong>{accuracy}%</strong></article><article className="stat-card"><span>저장된 오답</span><strong>{wrongNotes.length}개</strong></article><article className="stat-card"><span>최근 학습</span><strong>{latest?.title||"학습 전"}</strong></article></section>
  <section className="learning-center-grid"><article className="panel ai-focus-card"><span className="result-type">오늘의 우선순위</span><h2>{top}</h2><p>{wrongNotes.length?`이 자격증의 CBT 오답 ${wrongNotes.length}개를 분석한 결과입니다.`:"CBT 문제를 풀면 취약 과목과 추천 학습 순서를 자동으로 분석합니다."}</p><button className="primary" onClick={()=>onStartRecommended(top,20)}>취약문제 풀기</button></article><article className="panel"><h2>AI 진단</h2><p>{analysis.headline}</p><p className="muted">{analysis.summary}</p>{analysis.weakSubjects.slice(0,4).map(item=><button className="center-list-row" key={item.subject} onClick={()=>onStartRecommended(item.subject,10)}><span><strong>{item.subject}</strong><small>집중 복습</small></span><b>{item.wrongCount}개 오답</b></button>)}</article></section>
  <section className="panel"><h2>CBT 추천 학습 순서</h2><div className="recommendation-route"><button onClick={()=>onNavigate("bookmark")}><b>1</b><span>오답노트<small>틀린 문제 원인 확인</small></span></button><button onClick={()=>onNavigate("subject")}><b>2</b><span>과목별 학습<small>취약 과목 보완</small></span></button><button onClick={()=>onNavigate("mock")}><b>3</b><span>모의고사<small>실전 점수 확인</small></span></button><button onClick={()=>onNavigate("report")}><b>4</b><span>성장 리포트<small>CBT 성장 흐름 확인</small></span></button></div></section>
 </main>;
}
