# MakerOS Product Alpha v0.10 업데이트 요약

## 변경된 화면

### 주제별 학습
- `출제 회차`를 `출제 빈도`로 변경
- 주제별 문제 수와 서로 다른 출제 시험 수를 분리 표시
- 3·5·10개 시험 이상 필터를 실제 시험 ID 수로 계산

### 문제 해설
- 등록 해설이 있으면 등록 해설을 우선 표시
- 등록 해설이 없으면 답안 공개 직후 AI 해설 자동 생성
- 1차 해설 생성 후 별도의 2차 검증 요청 수행
- 공식 정답 번호와 다른 결론, 문항 불확실성, 정답표 우려가 있으면 해설 차단
- 공식 정답은 AI 결과와 관계없이 기존 `answerIndex`를 유지
- 검증된 해설은 브라우저에 캐시
- 이미지 문제는 현재 자동 해설 차단

## 주요 변경 파일

- `src/pages/TopicStudyPage.jsx`
- `src/pages/ExamPage.jsx`
- `src/utils/cbtExplanation.js`
- `server/cbtExplanation.mjs`
- `server/server.mjs`
- `src/styles.css`

## 배포 전 확인

```bash
npm install
npm run test:learning
npm run test:explanation
npm run check
npm run build
```
