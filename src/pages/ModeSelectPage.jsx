export default function ModeSelectPage({ exam, onStart, onBack }) {
  const modes = [["연습모드", "답을 선택하면 정답을 바로 확인합니다."], ["시험모드", "제출 후 점수와 정답을 확인합니다."], ["실전모드", "제한 시간과 함께 실제 시험처럼 풉니다."]];
  return <main className="page-shell"><button className="text-button" onClick={onBack}>← 기출문제</button><div className="page-heading"><h1>{exam?.title || `${exam?.year}년 ${exam?.round}`}</h1><p>원하는 풀이 방식을 선택해 시작하세요.</p></div><section className="mode-grid">{modes.map(([mode, detail]) => <article className="mode-card" key={mode}><h2>{mode}</h2><p>{detail}</p><button className="primary" onClick={() => onStart(mode)}>{mode} 시작</button></article>)}</section></main>;
}
