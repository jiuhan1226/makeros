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
  "JUDGE_ACCOUNT_SETUP.md",
  "scripts/seed-demo-account.mjs",
];

for (const file of requiredFiles) {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) throw new Error(`제출 필수 파일 누락: ${file}`);
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
for (const section of ["문제 정의", "아키텍처", "기술 스택", "실행 방법", "AI 사용 내역", "라이선스", "심사 계정"]) {
  if (!readme.includes(section)) throw new Error(`README 필수 섹션 누락: ${section}`);
}

const env = fs.readFileSync(path.join(root, ".env.example"), "utf8");
for (const key of ["DEMO_ACCOUNT_EMAIL", "DEMO_ACCOUNT_PASSWORD", "DEMO_CERTIFICATE_ID"]) {
  if (!env.includes(key)) throw new Error(`심사 계정 환경변수 누락: ${key}`);
}
for (const forbidden of ["VITE_DEMO_ACCOUNT_EMAIL", "VITE_DEMO_ACCOUNT_PASSWORD"]) {
  if (env.includes(forbidden)) throw new Error(`클라이언트 노출 위험 환경변수 발견: ${forbidden}`);
}

const main = fs.readFileSync(path.join(root, "src/main.jsx"), "utf8");
for (const forbidden of ["CompetitionPage", "global-demo-banner", "isDemoUser"]) {
  if (main.includes(forbidden)) throw new Error(`제품 화면에 심사용 분기 잔존: ${forbidden}`);
}

const auth = fs.readFileSync(path.join(root, "src/components/AuthModal.jsx"), "utf8");
if (auth.includes("데모 계정으로 시작") || auth.includes("VITE_DEMO")) {
  throw new Error("로그인 화면에 특수 데모 로그인 기능이 남아 있습니다.");
}

console.log("Submission readiness test passed.");
