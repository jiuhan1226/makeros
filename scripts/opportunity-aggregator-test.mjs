import assert from "node:assert/strict";
import { dedupeOpportunities, parseOpportunityHtml } from "../server/opportunityAggregator.mjs";

const source = { id: "fixture", name: "테스트 공고", url: "https://example.com/list", type: "공모전" };
const html = `
  <article><a href="/contest/1">2026 청소년 로봇 아이디어 공모전</a><p>대상: 전국 고등학생 · 접수 2026.09.01 ~ 2026.10.04 · 주최: 로봇협회</p></article>
  <article><a href="/contest/2">대학생 전용 마케팅 대외활동</a><p>대학생만 지원 · 2026.10.10</p></article>
`;
const parsed = parseOpportunityHtml(html, source);
assert.equal(parsed.length, 1, "고등학생 참여 근거가 있는 공고만 포함해야 합니다.");
assert.equal(parsed[0].deadline, "2026-10-04");
assert.equal(parsed[0].audienceEvidence, "청소년");
const deduped = dedupeOpportunities([parsed[0], { ...parsed[0], id: "duplicate", title: "제1회 2026 청소년 로봇 아이디어 공모전" }]);
assert.equal(deduped.length, 1, "연도·회차 표현이 다른 같은 공고는 중복 제거해야 합니다.");
console.log("[opportunity-aggregator-test] OK");
