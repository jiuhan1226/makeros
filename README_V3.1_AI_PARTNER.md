# MakerOS v3.1 · AI Partner Revision

이 디렉터리는 기존 MakerOS v1.0.3 코드를 보존한 상태에서 PRD v3.1의 `프로필 → 계획 → 학생 확정 → 앱 안 학습 → 기록 → 재계획` 닫힌 루프를 추가한 버전입니다.

> 기존 `README.md`와 기존 Learn / Invent / Build / Portfolio / Career 구현은 삭제하지 않았습니다.

## v3.1 핵심 화면

- **오늘**: AI가 제안한 1~5개 행동, 추천 이유, 가능한 시간, 다가오는 마감
- **계획**: 12주 로드맵, 주간 분량, 계획 버전, diff, 확정/보류/롤백
- **캘린더**: 내신·자격증·취업·대회 마감을 한 시간축에서 확인
- **학습**: 기존 CBT·PDF·AI 노트·Tutor 기능 재사용
- **목표**: 학년·전공·가능 시간·고정 일정·내신·자격증·취업·활동 입력

## 계획 안전 구조

1. 학생의 최신 정보 스냅샷을 만든다.
2. `src/utils/aiPartner.js`가 하드 제약을 먼저 적용한 규칙 기반 12주 계획을 만든다.
3. 로그인 + Gemini 사용 가능 시 `/api/partner/plan`이 이유·우선순위·표현을 보조한다.
4. 클라이언트 검증기가 주간/일일 가능 시간을 다시 검사한다.
5. 결과는 `draft` 계획 버전으로 저장한다.
6. 학생이 확인 후 확정해야 `active`가 된다.
7. CBT 결과나 행동 완료 이벤트는 새 `draft` 재계획안을 만든다.
8. 이전 확정 버전은 보존되어 롤백할 수 있다.

## 데이터

v3.1 파트너 상태는 로컬에서 `makeros-ai-partner-v3.1` 키로 별도 보존되며, 로그인 사용자는 기존 Firestore cloud state 문서의 `partnerState` 필드에도 동기화됩니다.

주요 엔터티:

- profile
- academics
- certificateGoal
- careerGoal
- activities
- planVersions
- activePlanVersionId / pendingPlanVersionId
- changeEvents

## 실행

Node.js 22 권장:

```powershell
npm.cmd install
npm.cmd run test:partner
npm.cmd run build
npm.cmd run dev
```

## AI가 바꾸지 않는 값

- 학생이 입력한 성적
- 시험·대회 마감
- 자격증 취득 상태
- 희망 기업·직무
- CBT 공식 정답과 점수
- 고정 일정과 학생의 가능 시간

AI 응답에 문제가 있으면 규칙 기반 계획을 사용하며 직전 확정 계획은 유지됩니다.
