# PRD v3.1 → 코드 구현 추적표

| PRD 요구 | 구현 |
|---|---|
| PRO-001 학년·전공·가능 시간·고정 일정 | `PartnerGoalsPage.jsx`, `aiPartner.js` |
| PRO-002 내신 현재·목표·시험일 | `PartnerGoalsPage.jsx` |
| PRO-003 자격증·시험 회차/상태·CBT 기록 | `PartnerGoalsPage.jsx`, `main.jsx` CBT 결과 연동 |
| PRO-004 희망 기업·직무·지원 시기 | `PartnerGoalsPage.jsx` |
| PRO-005 대회·프로젝트·마감 | `PartnerGoalsPage.jsx`, `PartnerCalendarPage.jsx` |
| PLN-001 12주·주간·오늘 계획 | `buildDeterministicPlan()` + `/api/partner/plan` |
| PLN-002 시간 초과·마감·제약 검증 | `validatePartnerPlan()` |
| PLN-003 학생 이동·축소·삭제·고정 | 현재 MVP는 목표/시간 수정 후 재계획으로 반영, 직접 드래그 편집은 후속 |
| PLN-004 변화 기반 변경안 | CBT 결과/오늘 행동 완료 → pending 재계획 |
| PLN-005 적용·보류·롤백 | `confirmPendingPlan`, `discardPendingPartnerPlan`, `rollbackPartnerPlan` |
| SCH-001 계획→내신 학습 | 오늘 행동의 `academic` CTA → PDF 학습 |
| SCH-002 자료·확인문제·자기평가 | 기존 PDF Study/Quiz 기능 재사용 |
| SCH-003 결과→계획 | 행동 완료 이벤트 기반 재계획, 과목별 자동 점수 연동은 후속 |
| CBT-001 계획→CBT | 오늘 행동의 `cbt` CTA → 자격증 학습 |
| CBT-002 공식 정답 채점 | 기존 CBT 공식 정답 코드 유지 |
| CBT-003 CBT 결과→다음 계획 | `recordFinishedSession()`에서 `certificateGoal.cbtAccuracy` 갱신 후 draft 재계획 |
| REC-001 계획 행동 기록 | active plan today item status + changeEvents |
| REC-002 프로필/계획 버전 연결 | planVersions + basedOnEventId |
| REC-003 내신/CBT 지표 분리 | 기존 learning state 구조 유지 + partnerState 별도 저장 |
| NFR-003 모바일 320px | v1.0.3 반응형 + v3.1 partner CSS |
| NFR-004 버전/원인 추적 | planVersions, changeEvents, rollback |
| NFR-005 가능 시간 초과 금지 | 일/주 분량 clamp 검증 |

## 의도적으로 후속으로 남긴 항목

- 주간 계획 항목의 드래그·드롭 직접 편집
- 특정 내신 과목 학습 세션을 planItemId와 자동 연결하는 전용 화면
- 기관 공식 일정 자동 수집
- 취업 공고 자동 연동
- 합격 가능성/취업 성공률 예측
