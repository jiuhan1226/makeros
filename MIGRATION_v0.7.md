# MakerOS v0.7 학습 데이터 이전 안내

## 자동으로 처리되는 항목

앱 시작 시 기존 `studylock-v3-state`를 읽어 다음 기준으로 분리합니다.

- 실전모드·시험모드·맞춤 모의고사 → `history`
- 연습모드 → `practiceHistory`
- 선택 답안이 없는 과거 오답노트 → 제거
- 기존 `learningProgress`가 없으면 빈 배열로 초기화

기존 데이터는 원본 LocalStorage 키 안에서 새 구조로 다시 저장됩니다.

## 새로운 학습 범위

| studyScope | 의미 | 과목·주제 진도 반영 |
|---|---|---|
| `exam` | 기출 실전 시험 | 아니요 |
| `mock` | 맞춤 모의고사 | 아니요 |
| `exam-practice` | 한 회차 기출 연습 | 아니요 |
| `subject` | 과목별 학습 | 과목 진도에만 반영 |
| `topic` | 주제별 학습 | 주제 진도에만 반영 |
| `recommended` | AI 추천 학습 | 아니요 |
| `wrong-review` | 반복 오답 | 아니요 |
| `due-review` | SRS 자동 복습 | 아니요 |
| `search` | 검색 결과 학습 | 아니요 |
| `pdf` | PDF 이해도 확인 | CBT 진도와 분리 |

## 연습모드 채점 기준

100문제 중 8문제만 답했다면 결과의 `total`은 8입니다. 정답과 오답도 이 8문제 안에서만 계산하며, 나머지 92문제는 `unanswered`로만 표시합니다.

## Firestore

문제별 기록은 시험형과 연습형으로 분리됩니다.

```text
users/{uid}/cbtProgress/{questionId}
users/{uid}/cbtPracticeProgress/{questionId}
```

같은 풀이에서 자기평가를 여러 번 바꿔도 동일한 `attemptId`를 사용하므로 풀이·정답·오답 횟수가 중복 증가하지 않습니다.

## 배포 후 확인 순서

1. `npm run test:learning`
2. `npm run build`
3. 연습모드에서 일부 문제만 답하고 제출
4. 시험형 누적 풀이가 증가하지 않는지 확인
5. 기출 연습이 과목·주제 진도에 들어가지 않는지 확인
6. 과목별 학습 후 해당 과목 진도만 증가하는지 확인
7. 주제별 학습 후 해당 주제 진도만 증가하는지 확인
8. 자기평가 저장 후 학습 운영센터의 자동 복습 수가 갱신되는지 확인
