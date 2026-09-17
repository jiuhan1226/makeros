import assert from "node:assert/strict";
import { dedupeOpportunities, parseOpportunityHtml } from "../server/opportunityAggregator.mjs";

const source = { id: "fixture", name: "테스트 공고", url: "https://example.com/list", type: "공모전" };
const html = `
  <article><a href="/contest/1">2026 청소년 로봇 아이디어 공모전</a><p>대상: 전국 고등학생 · 접수 2026.09.01 ~ 2026.10.04 · 주최: 로봇협회</p></article>
  <article><a href="/contest/2">대학생 전용 마케팅 대외활동</a><p>대학생만 지원 · 2026.10.10</p></article>
  <article><a href="/contest/3">[학교 밖 청소년] 공모전 찾는 방법!</a><p>청소년 · 2026.10.20</p></article>
  <article><a href="/contest/4">3줄 요약/ 과거 수상작 분석 결과 제공!</a><p>청소년 · 2026.10.20</p></article>
  <article><a href="/contest/5">대회·공모전 전체</a><p>청소년 · 2026.10.20</p></article>
`;
const parsed = parseOpportunityHtml(html, source);
assert.equal(parsed.length, 1, "고등학생 참여 근거가 있는 공고만 포함해야 합니다.");
assert.equal(parsed[0].deadline, "2026-10-04");
assert.equal(parsed[0].audienceEvidence, "청소년");
assert.equal(parsed[0].verifiedAnnouncement, true, "모집 중인 실제 공고임이 확인되어야 합니다.");
assert.ok(parsed[0].verification.includes("상세 페이지"), "검증 근거가 사용자에게 제공되어야 합니다.");
const deduped = dedupeOpportunities([parsed[0], { ...parsed[0], id: "duplicate", title: "제1회 2026 청소년 로봇 아이디어 공모전" }]);
assert.equal(deduped.length, 1, "연도·회차 표현이 다른 같은 공고는 중복 제거해야 합니다.");

const educationSource = { id: "education", name: "교육청", url: "https://edu.example.go.kr/notice/list.do", type: "교육청 공고", kind: "official" };
const educationHtml = `<article><a href="/notice/view.do?id=71">2026 전국 고등학생 AI 경진대회 참가 모집</a><p>접수 2026.09.18 ~ 2026.11.02 · 대상 고등학생 · 주최: 교육청</p></article>`;
const education = parseOpportunityHtml(educationHtml, educationSource);
assert.equal(education.length, 1, "교육청의 실제 학생 대회 공고도 수집해야 합니다.");
assert.equal(education[0].sourceKind, "official", "교육청 원문은 공공기관 출처로 표시해야 합니다.");
console.log("[opportunity-aggregator-test] OK");
