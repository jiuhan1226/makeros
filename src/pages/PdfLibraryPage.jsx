import { useMemo, useState } from "react";
import { deletePdfDocument } from "../utils/studyPlatform";
export default function PdfLibraryPage({ library, onRefresh, onOpen, onCreateAssets }){
 const [query,setQuery]=useState(""); const list=useMemo(()=>library.filter(x=>x.name.toLowerCase().includes(query.toLowerCase())),[library,query]);
 return <main className="page-shell"><section className="page-title"><div><span className="eyebrow">PDF LIBRARY</span><h1>PDF 라이브러리</h1><p>업로드한 자료를 이어서 학습하고 AI 노트와 단어카드를 만들어 보세요.</p></div><button className="primary" onClick={()=>onOpen(null,1)}>새 PDF 업로드</button></section>
 <section className="panel library-toolbar"><input placeholder="PDF 이름 검색" value={query} onChange={e=>setQuery(e.target.value)}/><strong>{list.length}개 자료</strong></section>
 <section className="pdf-library-grid">{list.map(doc=><article className="panel pdf-library-card" key={doc.id}><div className="pdf-file-icon">PDF</div><div><h3>{doc.name}</h3><p>{doc.pageCount||doc.pages?.length||0}쪽 · 최근 학습 {doc.lastPage||1}쪽</p><small>{new Date(doc.updatedAt||doc.createdAt).toLocaleString("ko-KR")}</small></div><div className="library-actions"><button className="primary" onClick={()=>onOpen(doc,doc.lastPage||1)}>이어서 학습</button><button className="secondary" onClick={()=>onCreateAssets(doc)}>AI 노트·카드</button><button className="text-button danger-text" onClick={()=>{if(confirm("라이브러리에서 삭제할까요?")){deletePdfDocument(doc.id);onRefresh();}}}>삭제</button></div></article>)}{!list.length&&<div className="empty-state">아직 저장된 PDF가 없어요. 새 PDF를 업로드해 학습을 시작해 보세요.</div>}</section></main>
}
