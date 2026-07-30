import React,{useEffect,useMemo,useState} from "react";
import { postJson } from "../utils/api";

const PARTICLES=["으로부터","에게서","에서는","으로는","이라는","이라고","까지도","으로","에서","에게","보다","처럼","만큼","부터","까지","이나","라도","이며","하고","와의","과의","들의","에는","에도","만의","만을","만이","은","는","이","가","을","를","의","에","로","과","와","도","만"];
const STOP=new Set(`무엇 대한 설명 가장 다음 옳은 것은 아닌 경우 문제 정답 보기 해당 관련 이용 사용 방법 종류 특징 의미 공통 학습 자료 페이지 PDF pdf 파일 내용 기준 정보 기능 구성 설계 업무 있다 없다 한다 된다 이다 그리고 또는 또한 위한 통한 대해 에서 으로 로서 경우 것이다 의해 관한 각각 매우 일반 주로 필요 가능 제공 적용 포함 활용 인간 기술 시스템 회로 특허 하는 만든 만들기 유형 시대 개요 세부 판단 직접 직업 교육과정 모듈 능력단위 학습모듈 교수학습 평가 출처 인용 참고문헌 저작권 copyright isbn doi 표 그림 페이지 쪽 장 절`.split(/\s+/));
const TREE_CACHE_KEY="makeros-pdf-learning-trees-v3";
function stripPdfExtension(name=""){return String(name).replace(/\.pdf$/i,"").trim();}
function readTreeCache(){try{return JSON.parse(localStorage.getItem(TREE_CACHE_KEY)||"{}");}catch{return{};}}
function saveTreeCache(cache){localStorage.setItem(TREE_CACHE_KEY,JSON.stringify(cache));}
function norm(v=""){return stripPdfExtension(v).toLowerCase().replace(/[^가-힣a-z0-9]/g,"");}
function belongsToPdf(item,doc){
  if(!item||!doc)return false;
  if(item.pdfId)return item.pdfId===doc.id;
  return norm(item.sourceName)===norm(doc.name);
}
function cleanTerm(raw=""){
  let s=String(raw).replace(/\[[^\]]*\]|\([^)]*(출처|참고|인용|쪽|페이지)[^)]*\)/gi,"").replace(/https?:\/\/\S+|\S+@\S+|\b(?:isbn|doi|kci)\b[^\s]*/gi,"").trim();
  s=s.replace(/^[\d\s.·,:;\-–—]+|[\d\s.·,:;\-–—]+$/g,"").replace(/\s+/g," ");
  for(const p of PARTICLES){if(s.length>p.length+1&&s.endsWith(p)){s=s.slice(0,-p.length);break;}}
  return s;
}
function validTerm(s=""){
  if(!s||s.length<2||s.length>36)return false;
  if(STOP.has(s)||s.split(/\s+/).some(x=>STOP.has(x)))return false;
  if(/^\d|\d{5,}/.test(s)||/[A-Z]{2}\d{4,}/.test(s))return false;
  if(/(한다|된다|이다|있다|없다|하는|하여|하며|하기|했던|되는|위한|대한)$/.test(s))return false;
  return true;
}
function uniqueConcepts(list=[]){
  const out=[];
  for(const c of list){
    const name=cleanTerm(c.name||c.label||"");
    if(c.id!=="root"&&!validTerm(name))continue;
    if(out.some(x=>norm(x.name)===norm(name)))continue;
    out.push({...c,id:c.id||`c${out.length}`,name,selected:c.selected!==false,parentId:c.parentId||null,reason:c.reason||"AI 노트·단어카드 기반 핵심 개념"});
  }
  return out;
}

function buildSafeTree(concepts,rootId){
  const active=concepts.filter(c=>c.selected!==false);
  const byId=new Map(active.map(c=>[c.id,c]));
  const children=new Map(active.map(c=>[c.id,[]]));
  const root=byId.get(rootId)||active.find(c=>!c.parentId)||active[0];
  if(!root)return {root:null,children:new Map(),overflow:[]};
  const createsCycle=(id,parentId)=>{
    const seen=new Set([id]); let cur=parentId;
    while(cur&&byId.has(cur)){if(seen.has(cur))return true;seen.add(cur);cur=byId.get(cur)?.parentId;}
    return false;
  };
  for(const c of active){
    if(c.id===root.id)continue;
    let parentId=c.parentId;
    if(!parentId||!byId.has(parentId)||parentId===c.id||createsCycle(c.id,parentId))parentId=root.id;
    children.get(parentId)?.push(c);
  }
  const orderIndex=new Map(active.map((c,i)=>[c.id,i]));
  for(const list of children.values())list.sort((a,b)=>(orderIndex.get(a.id)||0)-(orderIndex.get(b.id)||0));
  const kept=new Map(active.map(c=>[c.id,[]])); const overflow=[];
  const walk=(id,depth,path)=>{
    const list=children.get(id)||[];
    list.forEach((child,index)=>{
      if(depth>=2||index>=6){overflow.push(child);return;}
      kept.get(id).push(child);
      if(!path.has(child.id))walk(child.id,depth+1,new Set([...path,child.id]));
    });
  };
  walk(root.id,0,new Set([root.id]));
  const shown=new Set([root.id]);
  for(const [id,list] of kept){if(list.length){shown.add(id);list.forEach(c=>shown.add(c.id));}}
  active.forEach(c=>{if(!shown.has(c.id)&&!overflow.some(x=>x.id===c.id))overflow.push(c);});
  return {root,children:kept,overflow:[...new Map(overflow.map(c=>[c.id,c])).values()]};
}

function resolveInitialPdfId(initialQuery,pdfLibrary){
  const raw=String(initialQuery||"").trim();
  if(!raw)return "";
  return (pdfLibrary||[]).find(doc=>doc.id===raw||norm(doc.name)===norm(raw))?.id||"";
}

export default function KnowledgeGraphPage({initialQuery="",pdfLibrary=[],assets={},onOpenPdf,onAskTutor,onOpenAsset}){
  const [selectedPdfId,setSelectedPdfId]=useState(()=>resolveInitialPdfId(initialQuery,pdfLibrary));
  const [purpose,setPurpose]=useState("자료 이해");
  const [analysis,setAnalysis]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [reviewOpen,setReviewOpen]=useState(false);
  const [selectedId,setSelectedId]=useState("root");
  const [expanded,setExpanded]=useState(new Set(["root"]));
  const [mergeIds,setMergeIds]=useState([]);
  const doc=useMemo(()=>(pdfLibrary||[]).find(item=>item.id===selectedPdfId)||null,[pdfLibrary,selectedPdfId]);
  const docNotes=useMemo(()=>(assets?.notes||[]).filter(item=>belongsToPdf(item,doc)),[assets,doc]);
  const docCards=useMemo(()=>(assets?.cards||[]).filter(item=>belongsToPdf(item,doc)),[assets,doc]);

  useEffect(()=>{
    const nextId=resolveInitialPdfId(initialQuery,pdfLibrary);
    if(nextId)setSelectedPdfId(nextId);
  },[initialQuery,pdfLibrary]);

  useEffect(()=>{
    setError("");
    if(!doc){setAnalysis(null);setSelectedId("root");setExpanded(new Set(["root"]));return;}
    const cached=readTreeCache()[doc.id];
    if(cached?.analysis?.sourcePdfId===doc.id){
      setAnalysis(cached.analysis);
      const cachedRoot=cached.analysis.concepts?.find(c=>!c.parentId)||cached.analysis.concepts?.[0];
      setSelectedId(cachedRoot?.id||"root");
      setExpanded(new Set([cachedRoot?.id||"root"]));
    }else{
      setAnalysis(null);
      setSelectedId("root");
      setExpanded(new Set(["root"]));
    }
  },[doc?.id]);

  useEffect(()=>{
    if(!doc?.id||!analysis||analysis.sourcePdfId!==doc.id)return;
    const cache=readTreeCache();
    cache[doc.id]={analysis,updatedAt:Date.now(),sourceName:doc.name};
    saveTreeCache(cache);
  },[analysis,doc?.id,doc?.name]);

  async function analyze({openReview=false}={}){
    if(!doc){setError("먼저 PDF를 선택해 주세요.");return;}
    setBusy(true);setError("");
    try{
      if(!docNotes.length&&!docCards.length)throw Error("이 PDF 전용 AI 노트 또는 단어카드가 없습니다. PDF 자료실에서 먼저 상세 학습 자료를 생성해 주세요.");
      const body=await postJson("/api/analyze-study-map",{
        sourceName:doc.name,
        purpose,
        notes:docNotes.map(n=>({title:n.title,summary:n.summary,keyPoints:n.keyPoints||[]})),
        cards:docCards.map(c=>({front:c.front,back:c.back})),
      },"AI 학습 트리 분석에 실패했습니다.");
      const concepts=uniqueConcepts(body.concepts||[]);
      const root=concepts.find(c=>!c.parentId)||concepts[0];
      const nextAnalysis={...body,concepts,sourcePdfId:doc.id,sourceName:doc.name};
      setAnalysis(nextAnalysis);setSelectedId(root?.id||"root");
      setExpanded(new Set([root?.id||"root",...concepts.filter(c=>c.parentId===root?.id).slice(0,2).map(c=>c.id)]));
      const cache=readTreeCache();cache[doc.id]={analysis:nextAnalysis,updatedAt:Date.now(),sourceName:doc.name};saveTreeCache(cache);
      if(openReview)setReviewOpen(true);
    }catch(e){setAnalysis(null);setError(e?.message||"AI 학습 트리를 만들지 못했습니다. 다시 시도해 주세요.");}
    finally{setBusy(false);}
  }

  const concepts=useMemo(()=>uniqueConcepts(analysis?.concepts||[]).filter(c=>c.selected!==false),[analysis]);
  const root=concepts.find(c=>!c.parentId)||concepts[0];
  const tree=useMemo(()=>buildSafeTree(concepts,root?.id),[concepts,root?.id]);
  const selected=concepts.find(c=>c.id===selectedId)||root;
  const relatedNotes=useMemo(()=>docNotes.filter(n=>norm(JSON.stringify(n)).includes(norm(selected?.name||""))).slice(0,6),[docNotes,selected]);
  const relatedCards=useMemo(()=>docCards.filter(c=>norm(JSON.stringify(c)).includes(norm(selected?.name||""))).slice(0,10),[docCards,selected]);
  const learningOrder=useMemo(()=>{
    const byId=new Map(concepts.map(c=>[c.id,c]));
    const ordered=(analysis?.learningOrder||[]).map(id=>byId.get(id)).filter(Boolean);
    return [...ordered,...concepts.filter(c=>c.id!==root?.id&&!ordered.some(x=>x.id===c.id))].slice(0,8);
  },[analysis,concepts,root]);

  function toggleExpand(id){setExpanded(prev=>{const next=new Set(prev);next.has(id)?next.delete(id):next.add(id);return next;});}
  function patch(id,changes){setAnalysis(a=>({...a,concepts:a.concepts.map(c=>c.id===id?{...c,...changes}:c)}));}
  function toggle(id){if(id===root?.id)return;const c=analysis.concepts.find(x=>x.id===id);patch(id,{selected:c.selected===false});}
  function rename(id){const c=analysis.concepts.find(x=>x.id===id);const name=cleanTerm(prompt("정확한 개념명을 입력하세요.",c?.name||"")||"");if(validTerm(name))patch(id,{name});}
  function merge(ids){if(ids.length<2)return;const first=analysis.concepts.find(c=>c.id===ids[0]);const name=cleanTerm(prompt("통합할 개념명을 입력하세요.",first?.name||"")||"");if(!validTerm(name))return;setAnalysis(a=>({...a,concepts:a.concepts.map(c=>c.id===ids[0]?{...c,name}:ids.includes(c.id)?{...c,selected:false}:c)}));setMergeIds([]);}

  const TreeNode=({node,depth=0})=>{
    const kids=tree.children.get(node.id)||[];
    const hasChildren=kids.length>0;
    const isOpen=expanded.has(node.id)||depth===0;
    return <div className={`learning-tree-branch depth-${depth}`}>
      <div className={`learning-tree-row ${selectedId===node.id?"selected":""}`}>
        <button className="tree-toggle" onClick={()=>hasChildren&&toggleExpand(node.id)} aria-label={isOpen?"접기":"펼치기"}>{hasChildren?(isOpen?"−":"+"):"·"}</button>
        <button className="tree-concept" onClick={()=>setSelectedId(node.id)}>
          <span className="tree-step">{depth===0?"START":depth}</span>
          <span className="tree-main"><strong>{node.name}</strong><small>{node.reason||"핵심 학습 개념"}</small></span>
          {hasChildren&&<span className="tree-count">{kids.length}</span>}
        </button>
      </div>
      {hasChildren&&isOpen&&<div className="learning-tree-children">{kids.map(child=><TreeNode key={child.id} node={child} depth={depth+1}/>)}</div>}
    </div>;
  };

  return <main className="page-shell studymap-page learning-tree-page">
    <section className="page-heading studymap-heading"><div><span className="eyebrow">PDF LEARNING TREE</span><h1>PDF Learning Tree</h1><p>CBT 자격증 학습과 분리된 영역입니다. 선택한 PDF 한 개의 AI 노트·단어카드만 사용합니다.</p></div><button className="secondary" disabled={!selected} onClick={()=>onAskTutor?.({question:selected?.name?`${selected.name} 개념을 쉽게 설명해줘`:"",pdfId:doc?.id||""})}>현재 개념 질문하기</button></section>

    <section className="card studymap-search-card">
      <div className="sm71-search-row">
        <select value={selectedPdfId} onChange={e=>setSelectedPdfId(e.target.value)} aria-label="학습 트리를 만들 PDF 선택">
          <option value="">PDF를 선택하세요</option>
          {(pdfLibrary||[]).map(item=><option key={item.id} value={item.id}>{stripPdfExtension(item.name)}</option>)}
        </select>
        <select value={purpose} onChange={e=>setPurpose(e.target.value)}><option>자료 이해</option><option>학교 수업</option><option>프로젝트</option><option>자유 학습</option></select>
        <button className="primary" disabled={busy||!doc} onClick={()=>analyze()}>{busy?"학습 트리 생성 중":"선택한 PDF 트리 만들기"}</button>
      </div>
      {doc&&<div className="pdf-tree-source-summary"><strong>{stripPdfExtension(doc.name)}</strong><span>AI 노트 {docNotes.length}개</span><span>단어카드 {docCards.length}개</span><small>이 PDF의 학습 자료만 반영했어요.</small></div>}
      {error&&<p className="sm7-warning">{error}</p>}
      {analysis&&<div className="sm8-pipeline"><span>{doc?.name} 전용</span><i>→</i><span>AI 노트 {analysis.sourceCounts?.notes||docNotes.length}개</span><i>→</i><span>단어카드 {analysis.sourceCounts?.cards||docCards.length}개</span><i>→</i><span>PDF Learning Tree</span></div>}
    </section>

    {analysis&&<>
      <section className="card learning-route-card"><div><span className="eyebrow">RECOMMENDED ORDER</span><h2>먼저 이 순서로 공부하세요</h2><p>현재 PDF 안의 개념만 기초에서 응용 순서로 정리했습니다.</p></div><div className="learning-route-steps">{learningOrder.map((c,i)=><button key={c.id} onClick={()=>{setSelectedId(c.id);setExpanded(prev=>new Set([...prev,c.parentId,root?.id].filter(Boolean)))}}><b>{i+1}</b><span>{c.name}</span></button>)}</div></section>

      <section className="learning-tree-workspace">
        <div className="card learning-tree-card">
          <header className="learning-tree-header"><div><span className="eyebrow">LEARNING TREE</span><h2>{stripPdfExtension(doc?.name)}</h2><p>이 트리는 PDF ID <code>{doc?.id}</code>에만 저장됩니다.</p></div><div className="tree-header-actions"><button className="secondary" onClick={()=>setExpanded(new Set(concepts.map(c=>c.id)))}>모두 펼치기</button><button className="secondary" onClick={()=>setExpanded(new Set([root?.id]))}>모두 접기</button><button className="secondary" onClick={()=>setReviewOpen(true)}>개념 편집</button></div></header>
          <div className="learning-tree-body">{tree.root?<TreeNode node={tree.root}/>:<p>표시할 개념이 없습니다.</p>}</div>
          {tree.overflow.length>0&&<div className="learning-tree-overflow"><strong>추가 핵심 개념</strong><p>지도가 복잡해지지 않도록 별도 목록으로 정리했습니다.</p><div>{tree.overflow.map(c=><button key={c.id} onClick={()=>setSelectedId(c.id)}>{c.name}</button>)}</div></div>}
        </div>

        <aside className="card learning-concept-panel">
          <span className="studymap-type concept">선택한 개념</span><h2>{selected?.name||"개념을 선택하세요"}</h2>
          <p className="concept-reason">{selected?.reason||"현재 PDF의 AI 노트와 단어카드에서 확인된 핵심 개념입니다."}</p>
          <div className="concept-status-grid pdf-tree-status"><div><span>현재 PDF</span><strong>{stripPdfExtension(doc?.name||"")}</strong></div><div><span>연결 AI 노트</span><strong>{relatedNotes.length}개</strong></div><div><span>연결 단어카드</span><strong>{relatedCards.length}개</strong></div></div>
          <div className="learning-actions"><button className="primary" onClick={()=>onAskTutor?.({question:`${selected?.name} 개념을 이 PDF 자료만 기준으로 쉽게 설명해줘`,pdfId:doc?.id||""})}>AI 설명 듣기</button>{doc&&<button className="secondary" onClick={()=>onOpenPdf?.(doc,1)}>이 PDF 열기</button>}</div>
          <div className="connected-learning-list"><strong>이 PDF 안에서 이어서 공부하기</strong>{relatedNotes.map((n,i)=><button key={`n-${i}`} onClick={()=>onOpenAsset?.("notes",n)}><span>AI 노트</span><b>{n.title||selected?.name}</b><small>열기 ›</small></button>)}{relatedCards.map((c,i)=><button key={`c-${i}`} onClick={()=>onOpenAsset?.("cards",c)}><span>단어카드</span><b>{c.front||selected?.name}</b><small>열기 ›</small></button>)}{!relatedNotes.length&&!relatedCards.length&&<p>현재 PDF에서 이 개념과 직접 연결된 노트나 카드가 없습니다.</p>}</div>
        </aside>
      </section>
    </>}

    {!analysis&&<section className="card sm7-empty"><h2>{doc?`${stripPdfExtension(doc.name)} 전용 트리가 아직 없습니다.`:"PDF를 먼저 선택하세요."}</h2><p>{doc?"이 PDF의 AI 노트와 단어카드로 개념 트리를 만들어 보세요.":"먼저 개념 트리를 만들 PDF를 선택하세요."}</p>{doc&&<button className="primary" disabled={busy} onClick={()=>analyze()}>{busy?"생성 중…":"이 PDF 트리 생성"}</button>}</section>}

    {reviewOpen&&analysis&&<div className="sm71-modal-backdrop" role="presentation" onMouseDown={e=>e.target===e.currentTarget&&setReviewOpen(false)}><section className="card sm71-review-modal" role="dialog" aria-modal="true" aria-label="핵심 개념 검토"><header><div><span className="eyebrow">CONCEPT REVIEW</span><h2>핵심 개념 검토</h2><p>관련 없는 개념을 제외하거나 이름을 수정하고, 비슷한 개념을 합칠 수 있습니다.</p></div><button className="secondary" onClick={()=>setReviewOpen(false)}>닫기</button></header><div className="sm71-review-list">{(analysis.concepts||[]).map(c=><article key={c.id} className={c.selected!==false?"selected":""}><label><input type="checkbox" checked={c.selected!==false} disabled={c.id===root?.id} onChange={()=>toggle(c.id)}/><span><b>{c.name}</b><small>{c.reason||"AI 검증 개념"}</small></span></label>{c.id!==root?.id&&<div><button onClick={()=>rename(c.id)}>이름 수정</button><label className="merge-check"><input type="checkbox" checked={mergeIds.includes(c.id)} onChange={()=>setMergeIds(v=>v.includes(c.id)?v.filter(x=>x!==c.id):[...v,c.id])}/>병합 선택</label></div>}</article>)}</div><footer><button className="secondary" disabled={mergeIds.length<2} onClick={()=>merge(mergeIds)}>선택 개념 병합</button><button className="primary" onClick={()=>{setMergeIds([]);setReviewOpen(false)}}>검토 완료</button></footer></section></div>}
  </main>;
}
