import assert from "node:assert/strict";
import fs from "node:fs";

const portfolio = fs.readFileSync(new URL("../src/pages/PortfolioPage.jsx", import.meta.url), "utf8");
const opportunities = fs.readFileSync(new URL("../src/pages/OpportunitiesPage.jsx", import.meta.url), "utf8");
const career = fs.readFileSync(new URL("../src/pages/CareerPage.jsx", import.meta.url), "utf8");
const unifiedSearch = fs.readFileSync(new URL("../src/pages/UnifiedSearchPage.jsx", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../server/server.mjs", import.meta.url), "utf8");
const routes = fs.readFileSync(new URL("../src/utils/appRouting.js", import.meta.url), "utf8");

for (const label of ["이력서 작성", "자기소개서", "AI 작성 도움", "PDF로 저장·인쇄", "학교 검색", "학력사항"]) assert.ok(portfolio.includes(label), `이력서 기능 누락: ${label}`);
for (const field of ["selfIntro", "strengths", "motivation", "aspiration"]) assert.ok(portfolio.includes(field), `자소서 문항 누락: ${field}`);
assert.ok(portfolio.includes("official-resume-print"), "인쇄 전용 3쪽 문서 누락");
assert.ok(server.includes('/api/resume/assist'), "자소서 AI API 누락");
assert.ok(server.includes('/api/career/student-record-assist'), "생기부 활동 정리 AI API 누락");
assert.ok(server.includes('/api/opportunities'), "공모전 API 누락");
assert.ok(server.includes("collectOpportunities"), "다중 공고 수집기 연결 누락");
assert.ok(opportunities.includes("이력서에 저장") && opportunities.includes("관심 저장"), "공고 후속 행동 누락");
assert.ok(opportunities.includes("참여 대상 근거") && opportunities.includes("목표에 추가"), "참가 대상 검증 또는 계획 연결 누락");
assert.ok(career.includes("생기부 활동 정리") && career.includes("공식 학교생활기록부 문구는 담당 교사"), "진로·생기부 기록 경계 누락");
for (const shortcut of ["전체 자격증", "학교 급식", "학교 시간표", "공모전·대외활동"]) assert.ok(unifiedSearch.includes(shortcut), `통합 검색 바로가기 누락: ${shortcut}`);
assert.ok(routes.includes('opportunities: "opportunities"'), "공모전 라우팅 누락");
console.log("[resume-opportunities-test] OK");
