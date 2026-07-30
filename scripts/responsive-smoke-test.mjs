import fs from "node:fs";

const header = fs.readFileSync(new URL("../src/components/AppHeader.jsx", import.meta.url), "utf8");
const answerSheet = fs.readFileSync(new URL("../src/components/AnswerSheet.jsx", import.meta.url), "utf8");
const examPage = fs.readFileSync(new URL("../src/pages/ExamPage.jsx", import.meta.url), "utf8");
const scratchpad = fs.readFileSync(new URL("../src/components/ExamScratchpad.jsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

const checks = [
  [index.includes("viewport-fit=cover"), "viewport-fit=cover 메타 태그"],
  [header.includes("maker-mobile-drawer"), "모바일 전체 메뉴"],
  [header.includes("maker-mobile-bottom-nav"), "모바일 하단 빠른 메뉴"],
  [answerSheet.includes("answer-sheet-mobile-trigger"), "모바일 답안지 버튼"],
  [answerSheet.includes("answer-sheet-backdrop"), "모바일 답안지 배경"],
  [answerSheet.includes("answer-sheet-mode-tabs"), "태블릿 OMR·필기 패널"],
  [scratchpad.includes("canvas"), "태블릿 필기 캔버스"],
  [examPage.includes("exam-device-header"), "모바일 시험 전용 상단바"],
  [examPage.includes("makeros-exam-mode"), "시험 중 일반 내비게이션 숨김"],
  [styles.includes("@media(max-width:1080px)"), "기본 태블릿 중단점"],
  [styles.includes("(min-width:761px) and (max-width:1180px)"), "시험 전용 태블릿 분할 화면"],
  [styles.includes("@media(max-width:760px)"), "휴대폰 중단점"],
  [styles.includes("@media(max-width:480px)"), "소형 휴대폰 중단점"],
  [styles.includes("env(safe-area-inset-bottom)"), "모바일 안전 영역"],
  [styles.includes("prefers-reduced-motion"), "모션 접근성"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error(`FAIL: ${label}`);
  process.exit(1);
}
for (const [, label] of checks) console.log(`PASS: ${label}`);
console.log("Responsive smoke test passed.");
