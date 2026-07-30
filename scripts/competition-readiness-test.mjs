import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = [
  "LICENSE",
  "README.md",
  "COMPETITION_SUBMISSION_CHECKLIST.md",
  "PITCH_3MIN_SCRIPT.md",
  "AI_USAGE_DISCLOSURE.md",
  "ETHICS_SAFETY.md",
  "IMPACT_EVALUATION_PLAN.md",
  "COACHING_EXECUTION_LOG.md",
  "src/pages/CompetitionPage.jsx",
  "scripts/seed-demo-account.mjs",
];

for (const file of requiredFiles) {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) throw new Error(`대회 제출 필수 파일 누락: ${file}`);
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
for (const section of ["문제 정의", "아키텍처", "기술 스택", "실행 방법", "AI 사용 내역", "라이선스", "데모 계정"]) {
  if (!readme.includes(section)) throw new Error(`README 필수 섹션 누락: ${section}`);
}

const env = fs.readFileSync(path.join(root, ".env.example"), "utf8");
for (const key of ["VITE_DEMO_ACCOUNT_EMAIL", "VITE_DEMO_ACCOUNT_PASSWORD", "DEMO_ACCOUNT_EMAIL", "DEMO_ACCOUNT_PASSWORD"]) {
  if (!env.includes(key)) throw new Error(`데모 계정 환경변수 누락: ${key}`);
}

const competitionPage = fs.readFileSync(path.join(root, "src/pages/CompetitionPage.jsx"), "utf8");
for (const marker of ["기술 완성도", "창의성", "임팩트", "실행력", "발표력", "윤리", "English", "日本語"]) {
  if (!competitionPage.includes(marker)) throw new Error(`심사 기준 또는 다국어 표시 누락: ${marker}`);
}

console.log("Competition readiness test passed.");
