# MakerOS v0.12 검증 기록

## 통과한 검사

- `node scripts/learning-smoke-test.mjs`
- `node scripts/explanation-safety-test.mjs`
- `node scripts/learning-maintenance-test.mjs`
- `node scripts/copy-audit.mjs`
- 서버 및 AI 해설 유틸리티 `node --check`
- 전체 `src/main.jsx`, `src/pages/*.jsx`, `src/components/*.jsx` TypeScript JSX 구문 검사

## 카피 점검 범위

- 기출문제, 과목별 학습, 주제별 학습, 맞춤 모의고사
- 학습 통계, 성장 리포트, 학습 운영센터, 자격증 홈
- AI 해설 상태와 안전 안내
- PDF 학습, PDF 라이브러리, AI 노트·단어카드, Learning Tree, AI Tutor
- 통합 검색, 문제 검색, 플래너, 오답노트, 진로 로드맵, 관리자 센터
- 로딩, 빈 상태, 오류, 도움말 문구

## 빌드 관련

제작 환경에서 `npm install`이 제한 시간 내 완료되지 않아 Vite 프로덕션 번들은 직접 생성하지 못했습니다. Node.js 22 환경에서 아래 순서로 최종 확인하세요.

```bash
npm install
npm run test
npm run check
npm run build
npm run dev
```
