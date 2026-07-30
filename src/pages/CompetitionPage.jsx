import { useMemo, useState } from "react";

const COPY = {
  ko: {
    locale: "한국어",
    kicker: "COMPETITION DEMO & PRODUCT TRUST",
    title: "문제를 푸는 서비스에서, 반복을 관리하는 학습 운영체제로.",
    description: "MakerOS는 기출 풀이, 자기평가, 오답, 복습 주기와 공식 정답 검증 AI 해설을 연결해 오늘의 다음 학습을 설계합니다.",
    start: "3분 데모 시작",
    learning: "학습 운영센터 열기",
    demoBadge: "시연용 예시 데이터",
    demoNote: "아래 수치는 제품 흐름을 확인하기 위한 시연 데이터이며 실제 사용자 성과로 제시하지 않습니다.",
    guideTitle: "심사위원 3분 데모",
    guide: [
      ["1", "문제를 풀고 자기평가", "정답 여부와 ‘확실함·애매함·모름’을 함께 기록합니다.", "기출문제 열기", "past"],
      ["2", "검증된 AI 해설 확인", "공식 정답을 고정하고 1차 생성·2차 검증·코드 대조를 통과한 해설만 표시합니다.", "AI 해설 흐름 보기", "competition"],
      ["3", "다음 학습 자동 설계", "SRS 복습, 반복 오답, 취약 개념과 최근 수행량을 종합해 오늘의 학습을 추천합니다.", "학습 코치 열기", "learning"],
      ["4", "성장과 준비도 확인", "기출 범위, 회차, 숙련도, 실전 성적을 분리해 시험 준비도 근거를 공개합니다.", "성장 리포트 보기", "report"],
    ],
    criteriaTitle: "심사 기준별 증거",
    criteria: [
      ["기술 완성도 · 30", "실제 작동하는 CBT·PDF·AI 학습 흐름, Firebase 동기화, 재계산 가능한 풀이 기록, 테스트·빌드·배포 설정을 제공합니다."],
      ["창의성·혁신성 · 25", "점수 확인에서 끝나지 않고 자기평가, SRS, 반복 오답과 AI 해설 안전 검증을 하나의 학습 루프로 연결합니다."],
      ["임팩트 · 20", "직업계고·자격증 학습자가 ‘무엇을 공부할지 정하는 시간’을 줄이고 반복 오답과 기출 숙련을 관리하도록 설계했습니다."],
      ["실행력 · 15", "v0.1부터 v1.0까지 사용자 피드백과 실제 오류를 반영하며 데이터 분리, 주제 통합, 준비도 설명, AI 보안을 개선했습니다."],
      ["발표력 · 10", "한 문제 풀이부터 추천 학습과 성장 변화까지 하나의 3분 시나리오로 시연할 수 있습니다."],
    ],
    architectureTitle: "신뢰 가능한 AI 구조",
    architecture: [
      ["규칙 기반", "공식 정답 채점, 복습일, 준비도와 통계는 결정 가능한 코드로 계산"],
      ["AI 적용", "세부 주제 분류, 공식 정답 기반 해설, 취약 원인 설명과 PDF 학습자료 생성"],
      ["안전 장치", "Firebase 인증, 요청 제한, 문제 해시, 2차 검증, 서버 서명, 오류 신고와 관리자 검토"],
    ],
    ethicsTitle: "윤리·안전 체크",
    ethics: ["개인 학습 데이터는 사용자별 경로에 저장", "AI 생성 결과를 명확히 표시", "공식 정답보다 AI 결론을 우선하지 않음", "이미지·근거 부족 문제는 안전한 해설을 표시하지 않음", "미성년자 사용 환경을 고려해 민감정보 입력을 요구하지 않음", "MIT 오픈소스 라이선스와 외부 AI 사용 내역 공개"],
    validationTitle: "임팩트 검증 설계",
    validation: "실제 성과는 데모 수치와 분리합니다. 파일럿에서는 동일 문제 재시험 정답률, 반복 오답 감소율, 학습 계획 수립 시간, 추천 학습 완료율을 사전·사후로 측정하도록 설계했습니다.",
    multilingual: "심사·온보딩 화면 한국어·영어·일본어 지원",
  },
  en: {
    locale: "English",
    kicker: "COMPETITION DEMO & PRODUCT TRUST",
    title: "From solving questions to operating a repeatable learning system.",
    description: "MakerOS connects past-exam practice, confidence reflection, mistakes, spaced review and verified AI explanations to decide the learner's next action.",
    start: "Start 3-minute demo",
    learning: "Open learning operations",
    demoBadge: "Demonstration data",
    demoNote: "The figures below are sample data for product demonstration and are not presented as real user outcomes.",
    guideTitle: "3-minute judge demo",
    guide: [
      ["1", "Answer and reflect", "Record correctness together with confident, unsure or unknown.", "Open past exams", "past"],
      ["2", "Read a verified AI explanation", "Only explanations that preserve the official answer and pass generation, verification and code checks are shown.", "View safety flow", "competition"],
      ["3", "Generate the next study action", "Spaced review, repeated errors, weak concepts and recent capacity form today's plan.", "Open learning coach", "learning"],
      ["4", "Inspect growth and readiness", "Coverage, exam sessions, mastery and mock performance are shown as separate evidence.", "Open growth report", "report"],
    ],
    criteriaTitle: "Evidence mapped to judging criteria",
    criteria: [
      ["Technical completeness · 30", "Working CBT, PDF and AI workflows, Firebase sync, immutable attempt events, tests, build and deployment configuration."],
      ["Creativity & innovation · 25", "A complete loop combining self-reflection, spaced repetition, repeated-error review and answer-locked AI explanations."],
      ["Impact · 20", "Designed to reduce planning friction and improve repeated practice for vocational and certification learners."],
      ["Execution · 15", "Iterative releases from v0.1 to v1.0 respond to real defects and user feedback across data, topics, readiness and AI safety."],
      ["Presentation · 10", "A single 3-minute narrative demonstrates question solving, safety, recommendation and measurable growth."],
    ],
    architectureTitle: "Trustworthy AI architecture",
    architecture: [["Deterministic logic", "Scoring, review dates, readiness and statistics are computed by code"], ["AI contribution", "Topic classification, answer-grounded explanation, weakness narration and PDF assets"], ["Safety layer", "Firebase auth, rate limits, hashes, second-pass verification, server signature, feedback and admin review"]],
    ethicsTitle: "Ethics & safety",
    ethics: ["User-scoped learning data", "Clear AI-generated labels", "AI never overrides the official answer", "Unsafe or unsupported explanations are hidden", "No sensitive data required for minor users", "MIT license and AI-use disclosure"],
    validationTitle: "Impact validation design",
    validation: "Demo figures are separated from real outcomes. The pilot protocol measures retest accuracy, repeated-error reduction, study-planning time and recommendation completion before and after use.",
    multilingual: "Korean, English and Japanese support on judging and onboarding surfaces",
  },
  ja: {
    locale: "日本語",
    kicker: "COMPETITION DEMO & PRODUCT TRUST",
    title: "問題を解くだけでなく、反復学習を運用する学習OSへ。",
    description: "MakerOSは過去問、自己評価、誤答、復習間隔、公式解答に基づく検証済みAI解説をつなぎ、次の学習を設計します。",
    start: "3分デモを開始",
    learning: "学習運用センター",
    demoBadge: "デモ用サンプルデータ",
    demoNote: "以下の数値は製品デモ用であり、実際の利用者成果として提示するものではありません。",
    guideTitle: "審査員向け3分デモ",
    guide: [
      ["1", "回答と自己評価", "正誤と一緒に「確実・曖昧・不明」を記録します。", "過去問を開く", "past"],
      ["2", "検証済みAI解説", "公式解答を固定し、生成・再検証・コード照合を通過した解説のみ表示します。", "安全設計を見る", "competition"],
      ["3", "次の学習を自動設計", "間隔反復、反復誤答、弱点、直近の学習量から今日の計画を作ります。", "学習コーチ", "learning"],
      ["4", "成長と準備度", "出題範囲、回次、習熟度、模試成績を分けて根拠を表示します。", "成長レポート", "report"],
    ],
    criteriaTitle: "審査基準への対応",
    criteria: [["技術完成度 · 30", "CBT・PDF・AIの実動フロー、Firebase同期、原本回答イベント、テスト・ビルド・配布設定。"], ["創造性・革新性 · 25", "自己評価、間隔反復、反復誤答、公式解答固定AI解説を一つの学習ループに統合。"], ["インパクト · 20", "職業教育・資格学習者の計画負担を減らし、過去問の反復習熟を支援。"], ["実行力 · 15", "v0.1からv1.0まで実際の不具合とフィードバックを継続反映。"], ["発表力 · 10", "問題回答から安全な解説、推薦、成長まで3分で実演可能。"]],
    architectureTitle: "信頼できるAI構造",
    architecture: [["ルールベース", "採点、復習日、準備度、統計はコードで決定"], ["AI活用", "トピック分類、公式解答ベース解説、弱点説明、PDF学習資料"], ["安全層", "認証、レート制限、ハッシュ、二次検証、署名、報告・管理者確認"]],
    ethicsTitle: "倫理・安全",
    ethics: ["ユーザー別学習データ", "AI生成表示", "AIは公式解答を上書きしない", "根拠不足の解説は非表示", "未成年者に機微情報を要求しない", "MITライセンスとAI利用履歴公開"],
    validationTitle: "効果検証設計",
    validation: "デモ数値と実際の成果を分離し、再テスト正答率、反復誤答の減少、学習計画時間、推薦完了率を事前・事後で測定します。",
    multilingual: "審査・オンボーディング画面で韓国語・英語・日本語を提供",
  },
};

export default function CompetitionPage({ onNavigate, isDemo = false, certificateName = "", summary = {} }) {
  const [language, setLanguage] = useState(() => localStorage.getItem("makeros-competition-locale") || "ko");
  const t = COPY[language] || COPY.ko;
  const metrics = useMemo(() => [
    ["기출 학습", `${summary.coveredSessions || 0}회차`],
    ["누적 풀이", `${summary.attemptCount || 0}문제`],
    ["반복 오답", `${summary.repeatedWrong || 0}문제`],
    ["시험 준비도", `${summary.readinessScore || 0}%`],
  ], [summary]);

  function changeLanguage(next) {
    setLanguage(next);
    localStorage.setItem("makeros-competition-locale", next);
  }

  return <main className="maker-page competition-page">
    <section className="competition-hero maker-card">
      <div>
        <span className="maker-kicker">{t.kicker}</span>
        <h1>{t.title}</h1>
        <p>{t.description}</p>
        <div className="competition-actions">
          <button className="maker-primary" onClick={() => onNavigate(isDemo ? "learning" : "catalog")}>{t.start}</button>
          <button className="maker-ghost" onClick={() => onNavigate("learning")}>{t.learning}</button>
        </div>
      </div>
      <aside>
        <div className="competition-language" aria-label="Language">
          {[["ko", "한국어"], ["en", "English"], ["ja", "日本語"]].map(([key, label]) => <button key={key} className={language === key ? "active" : ""} onClick={() => changeLanguage(key)}>{label}</button>)}
        </div>
        <span className="competition-demo-badge">{t.demoBadge}</span>
        <strong>{certificateName || "MakerOS CBT"}</strong>
        <div className="competition-metric-grid">{metrics.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
        <small>{t.demoNote}</small>
      </aside>
    </section>

    <section className="competition-section">
      <div className="maker-section-title"><span>GUIDED DEMO</span><h2>{t.guideTitle}</h2></div>
      <div className="competition-guide-grid">{t.guide.map(([number, title, description, action, target]) => <article className="maker-card" key={number}><b>{number}</b><h3>{title}</h3><p>{description}</p><button onClick={() => onNavigate(target)}>{action} →</button></article>)}</div>
    </section>

    <section className="competition-section">
      <div className="maker-section-title"><span>JUDGING EVIDENCE</span><h2>{t.criteriaTitle}</h2></div>
      <div className="competition-criteria-grid">{t.criteria.map(([title, description]) => <article className="maker-card" key={title}><h3>{title}</h3><p>{description}</p></article>)}</div>
    </section>

    <section className="competition-two-column">
      <article className="maker-card competition-trust-card">
        <span className="maker-kicker">ARCHITECTURE</span><h2>{t.architectureTitle}</h2>
        {t.architecture.map(([title, description], index) => <div key={title}><b>{index + 1}</b><span><strong>{title}</strong><small>{description}</small></span></div>)}
      </article>
      <article className="maker-card competition-trust-card">
        <span className="maker-kicker">ETHICS · P/F</span><h2>{t.ethicsTitle}</h2>
        <ul>{t.ethics.map((item) => <li key={item}>✓ {item}</li>)}</ul>
      </article>
    </section>

    <section className="maker-card competition-validation">
      <div><span className="maker-kicker">IMPACT VALIDATION</span><h2>{t.validationTitle}</h2><p>{t.validation}</p></div>
      <aside><strong>+5</strong><span>{t.multilingual}</span><small>MIT / Apache-2.0 compatible open-source submission structure</small></aside>
    </section>
  </main>;
}
