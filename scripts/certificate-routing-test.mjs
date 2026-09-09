import assert from "node:assert/strict";
import {
  buildCertificateShortcuts,
  certificateUnavailableReason,
  findCertificateForGoal,
} from "../src/utils/certificateRouting.js";

const certificates = [
  { id: "electrician", name: "전기기능사" },
  { id: "electronics", name: "전자 기능사" },
];

assert.equal(findCertificateForGoal({ name: "전자기능사" }, certificates)?.id, "electronics", "공백 차이는 허용해야 합니다.");
assert.equal(findCertificateForGoal({ name: "전자기능사 필기시험" }, certificates)?.id, "electronics", "필기시험 표기는 같은 종목으로 연결해야 합니다.");
assert.equal(findCertificateForGoal({ name: "전기기능사" }, certificates)?.id, "electrician", "전기와 전자를 정확히 구분해야 합니다.");
assert.equal(findCertificateForGoal({ name: "전기" }, certificates), null, "부분 일치로 다른 종목을 선택하면 안 됩니다.");
assert.equal(findCertificateForGoal({ name: "잘못된 이름", certificateId: "electronics" }, certificates)?.id, "electronics", "저장된 DB ID를 우선해야 합니다.");

const shortcuts = buildCertificateShortcuts([
  { id: "goal-1", name: "전자기능사" },
  { id: "goal-2", name: "전기기능사" },
  { id: "goal-3", name: "미등록기능사" },
], certificates);
assert.deepEqual(shortcuts.map((item) => [item.name, item.certificateId, item.supported]), [
  ["전자기능사", "electronics", true],
  ["전기기능사", "electrician", true],
  ["미등록기능사", "", false],
]);

assert.match(
  certificateUnavailableReason({ name: "미등록기능사" }, certificates, { databaseConfigured: true, catalogLoaded: true }),
  /문제 DB에 등록되지 않았습니다/,
);
assert.match(
  certificateUnavailableReason({ name: "전자기능사" }, certificates, { databaseConfigured: false, catalogLoaded: true }),
  /DB 연결이 설정되지 않아/,
);

console.log("certificate routing tests passed");
