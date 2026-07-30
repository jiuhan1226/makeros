# Validation v1.0

## 통과한 검사

- TypeScript transpile 기반 전체 JS / JSX / MJS 구문 검사: 55개 파일
- 학습·주제·시험 준비도 smoke test
- AI 해설 정답 충돌·서명 안전 test
- 원본 풀이 이벤트 기반 유지보수 test
- 런칭 카피 audit: 27개 페이지
- 대회 제출 준비 파일·README 필수 섹션 test

## 이 환경에서 완료하지 못한 검사

외부 npm 패키지 설치가 제한 시간 내 완료되지 않아 이 제작 환경에서는 Vite 번들 빌드를 다시 실행하지 못했습니다. 기반 v0.12는 사용자 환경에서 빌드가 성공했고, v1.0 변경 파일은 구문 검사와 로컬 로직 테스트를 통과했습니다.

제출 전 실제 환경에서 다음을 실행하세요.

```bash
npm install
npm run test
npm run check
npm run build
npm run dev
```

데모 계정은 Firebase 환경변수를 입력한 뒤 다음으로 생성합니다.

```bash
npm run seed:demo
```
