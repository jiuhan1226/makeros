# MakerOS Product Alpha v0.10 검증 결과

## 통과한 검사

- `npm run test:learning`
  - 주제 통합 및 12회차 준비도 로직
- `npm run test:explanation`
  - 문제·정답 변경 시 해설 캐시 해시 변경
  - 공식 정답과 다른 명시적 답안 표현 감지
  - 1차·2차 정답 번호 불일치 시 해설 차단
- `node --check server/server.mjs`
- `node --check server/cbtExplanation.mjs`
- `node --check src/utils/cbtExplanation.js`
- TypeScript JSX 구문 검사
  - `tsc --noEmit --allowJs --checkJs false --jsx react-jsx --moduleResolution bundler --module esnext --target es2022 src/main.jsx`

## 확인한 동작

- 출제 빈도는 문제 개수가 아닌 서로 다른 시험 ID 수로 계산
- 등록 시험 수보다 큰 빈도 필터 자동 비활성화
- 등록 해설이 있으면 AI를 호출하지 않고 등록 해설 우선 표시
- 등록 해설이 없으면 답안 공개 후 자동 생성 및 2차 검증
- 공식 정답과 충돌하거나 검증이 불확실하면 해설 숨김
- 이미지 포함 문제는 검증 불가능 안내 표시
- 검증 완료 AI 해설은 문제 내용과 정답을 포함한 지문 해시로 브라우저 캐시

## 실행하지 못한 검사

제작 환경에서 `npm install`이 네트워크 제한 시간 안에 끝나지 않아 Vite 프로덕션 번들(`npm run build`)은 실행하지 못했습니다. 로컬 또는 Render에서 다음 명령으로 최종 확인하세요.

```bash
npm install
npm run test:learning
npm run test:explanation
npm run check
npm run build
```
