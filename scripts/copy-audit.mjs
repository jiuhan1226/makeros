import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const pagesDir = new URL("../src/pages/", import.meta.url);
const blockedPhrases = [
  "등록된 모든 회차의 문제를 과목 기준으로 분류했습니다.",
  "연습모드로 즉시 채점",
  "문제 개수가 아니라",
  "원본 풀이 이벤트",
  "공식 정답표를 변경하지 않고",
  "실제로 답한",
  "STUDYLOCK KNOWLEDGE",
];

const files = (await readdir(pagesDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".jsx"))
  .map((entry) => entry.name);

const failures = [];
for (const file of files) {
  const text = await readFile(new URL(file, pagesDir), "utf8");
  for (const phrase of blockedPhrases) {
    if (text.includes(phrase)) failures.push(`${join("src/pages", file)}: ${phrase}`);
  }
}

if (failures.length) {
  console.error("Launch copy audit failed:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`MakerOS v0.12 launch copy audit passed (${files.length} page files).`);
