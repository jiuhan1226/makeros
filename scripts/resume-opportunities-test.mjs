import assert from "node:assert/strict";
import fs from "node:fs";

const portfolio = fs.readFileSync(new URL("../src/pages/PortfolioPage.jsx", import.meta.url), "utf8");
const opportunities = fs.readFileSync(new URL("../src/pages/OpportunitiesPage.jsx", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../server/server.mjs", import.meta.url), "utf8");
const routes = fs.readFileSync(new URL("../src/utils/appRouting.js", import.meta.url), "utf8");

for (const label of ["이력서 작성", "자기소개서", "AI 작성 도움", "PDF로 저장·인쇄", "학교 검색", "학력사항"]) assert.ok(portfolio.includes(label), `이력서 기능 누락: ${label}`);
for (const field of ["selfIntro", "strengths", "motivation", "aspiration"]) assert.ok(portfolio.includes(field), `자소서 문항 누락: ${field}`);
assert.ok(portfolio.includes("official-resume-print"), "인쇄 전용 3쪽 문서 누락");
assert.ok(server.includes('/api/resume/assist'), "자소서 AI API 누락");
assert.ok(server.includes('/api/opportunities'), "공모전 API 누락");
assert.ok(server.includes("gub=2"), "청소년 대상 필터 누락");
assert.ok(opportunities.includes("이력서에 저장") && opportunities.includes("관심 저장"), "공고 후속 행동 누락");
assert.ok(routes.includes('opportunities: "opportunities"'), "공모전 라우팅 누락");
console.log("[resume-opportunities-test] OK");
