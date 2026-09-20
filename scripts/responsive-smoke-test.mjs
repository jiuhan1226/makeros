import fs from "node:fs";

const header = fs.readFileSync(new URL("../src/components/AppHeader.jsx", import.meta.url), "utf8");
const answerSheet = fs.readFileSync(new URL("../src/components/AnswerSheet.jsx", import.meta.url), "utf8");
const examPage = fs.readFileSync(new URL("../src/pages/ExamPage.jsx", import.meta.url), "utf8");
const scratchpad = fs.readFileSync(new URL("../src/components/ExamScratchpad.jsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const growthReport = fs.readFileSync(new URL("../src/pages/GrowthReportPage.jsx", import.meta.url), "utf8");

const checks = [
  [index.includes("viewport-fit=cover"), "viewport-fit=cover 메타 태그"],
  [header.includes("maker-mobile-drawer"), "모바일 전체 메뉴"],
  [header.includes("maker-mobile-bottom-nav"), "모바일 하단 빠른 메뉴"],
  [answerSheet.includes("answer-sheet-mobile-trigger"), "모바일 답안지 버튼"],
  [answerSheet.includes("answer-sheet-backdrop"), "모바일 답안지 배경"],
  [answerSheet.includes("answer-sheet-mode-tabs"), "태블릿 OMR·필기 패널"],
  [scratchpad.includes("canvas"), "태블릿 필기 캔버스"],
  [examPage.includes("exam-device-header"), "모바일 시험 전용 상단바"],
  [examPage.includes("mobile-question-progress"), "모바일 문제 번호 요약"],
  [examPage.includes("makeros-exam-mode"), "시험 중 일반 내비게이션 숨김"],
  [styles.includes("@media(max-width:1080px)"), "기본 태블릿 중단점"],
  [styles.includes("(min-width:761px) and (max-width:1180px)"), "시험 전용 태블릿 분할 화면"],
  [styles.includes("@media(max-width:760px)"), "휴대폰 중단점"],
  [styles.includes("@media(max-width:480px)"), "소형 휴대폰 중단점"],
  [styles.includes("env(safe-area-inset-bottom)"), "모바일 안전 영역"],
  [styles.includes("overflow-y:auto!important") && styles.includes("overflow-wrap:anywhere"), "긴 문제·보기 독립 스크롤과 줄바꿈"],
  [styles.includes(".exam-checkpoint-status.saved{display:none}"), "모바일 저장 완료 안내 축약"],
  [styles.includes(".exam-mini-navigator.size-normal{width:112px}"), "모바일 미니 방향키 축소"],
  [styles.includes("prefers-reduced-motion"), "모션 접근성"],
  [growthReport.includes("report-mastery-head") && styles.includes(".report-mastery-head{display:flex!important"), "취약 개념명 가로 배치"],
  [styles.includes(".growth-message>p,.growth-message>small{display:block;max-width:100%"), "리포트 문장 화면 내 줄바꿈"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error(`FAIL: ${label}`);
  process.exit(1);
}
for (const [, label] of checks) console.log(`PASS: ${label}`);
console.log("Responsive smoke test passed.");
