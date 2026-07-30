# v0.8 검증 결과

실행한 검사:

```bash
node scripts/learning-smoke-test.mjs
tsc --noEmit --allowJs --checkJs false --jsx react-jsx --moduleResolution bundler --module esnext --target es2022 src/main.jsx
node --check src/firebase.js
node --check src/utils/learningEngine.js
node --check src/utils/topicClassifier.js
```

검증 항목:

- 연습모드에서 답한 문제만 채점
- 실전모드에서 전체 문항 채점
- 과거 미응답 오답 기록 제거
- 기존 `미분류 주제` 자동 복구
- 승강기·전기 핵심어 기반 주제 분류
- 자기평가 수정 시 풀이 횟수 중복 방지
- 원본 기출 회차 추적
- 12회차 × 회차당 문제 수 목표 계산
- 소수 문제만 푼 상태에서 준비도 과대평가 방지
- 권장 일일 문제 최소값 계산

`npm install`은 작업 환경의 네트워크 제한으로 완료되지 않아 Vite 프로덕션 번들은 직접 생성하지 못했습니다. TypeScript 구문·JSX import 검사는 통과했습니다.
