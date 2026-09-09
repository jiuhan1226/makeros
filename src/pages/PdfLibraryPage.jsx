import { useMemo, useState } from "react";
import { deletePdfDocument } from "../utils/studyPlatform";

export default function PdfLibraryPage({ library, onRefresh, onOpen, onCreateAssets }) {
  const [query, setQuery] = useState("");
  const list = useMemo(() => library.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())), [library, query]);
  return <main className="page-shell">
    <section className="page-title"><div><span className="eyebrow">PDF LIBRARY</span><h1>PDF 라이브러리</h1><p>교과서나 학습 자료를 올리고, 필요한 페이지부터 학습하세요.</p></div><button className="primary" onClick={() => onOpen(null, 1)}>새 PDF 업로드</button></section>

    <details className="panel school-study-tutorial" open={!library.length}>
      <summary><span>내신 처음 사용</span><strong>PDF를 먼저 업로드하세요</strong></summary>
      <div>
        <ol>
          <li><b>1</b><span><strong>PDF 선택</strong><small>교과서, 수업 자료, 시험 범위 파일을 올립니다.</small></span></li>
          <li><b>2</b><span><strong>학습할 페이지 열기</strong><small>본문을 보면서 필요한 내용을 확인합니다.</small></span></li>
          <li><b>3</b><span><strong>AI 학습 자료 만들기</strong><small>노트·개념카드·퀴즈를 생성합니다.</small></span></li>
        </ol>
        <button className="primary" onClick={() => onOpen(null, 1)}>PDF 선택하기</button>
      </div>
    </details>

    <section className="panel library-toolbar"><input placeholder="업로드한 PDF 이름 검색" value={query} onChange={(event) => setQuery(event.target.value)}/><strong>{list.length}개 자료</strong></section>
    <section className="pdf-library-grid">
      {list.map((doc) => <article className="panel pdf-library-card" key={doc.id}><div className="pdf-file-icon">PDF</div><div><h3>{doc.name}</h3><p>{doc.pageCount || doc.pages?.length || 0}쪽 · 최근 학습 {doc.lastPage || 1}쪽</p><small>{new Date(doc.updatedAt || doc.createdAt).toLocaleString("ko-KR")}</small></div><div className="library-actions"><button className="primary" onClick={() => onOpen(doc, doc.lastPage || 1)}>이어서 학습</button><button className="secondary" onClick={() => onCreateAssets(doc)}>AI 노트·개념카드</button><button className="text-button danger-text" onClick={() => { if (confirm("라이브러리에서 삭제할까요?")) { deletePdfDocument(doc.id); onRefresh(); } }}>삭제</button></div></article>)}
      {!list.length && <div className="empty-state">{library.length ? "검색한 이름의 PDF가 없습니다." : "아직 PDF가 없습니다. 위의 PDF 선택하기를 눌러 학습 자료를 올려 주세요."}</div>}
    </section>
  </main>;
}
