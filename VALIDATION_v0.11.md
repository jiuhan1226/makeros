# v0.11 검증 기록

통과한 검사:

- 연습모드 미응답 제외 채점
- 학습 경로 분리
- 동일 attemptId 중복 방지
- 원본 이벤트 기반 통계 재생성
- 서로 다른 날 정답 및 마스터 단계 판정
- 준비도 12회차 목표 계산
- AI 해설 정답 충돌 차단
- AI 해설 HMAC 서명 및 변조 차단
- JavaScript 서버/유틸 구문 검사
- 전체 JSX TypeScript 파서 검사

실행 명령:

```bash
npm run test
npm run check
npm run build
```

제작 환경에서는 외부 npm 설치가 제한 시간 안에 완료되지 않아 Vite 번들 빌드를 직접 수행하지 못할 수 있습니다. 사용자 환경에서 `npm install` 후 최종 빌드를 확인하세요.
