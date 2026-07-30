# MakerOS Architecture

## 설계 원칙

1. 정답과 점수는 결정 가능한 코드가 계산한다.
2. AI는 분류·설명·요약처럼 생성이 필요한 영역에 한정한다.
3. 모든 풀이를 원본 이벤트로 보존해 통계를 재계산할 수 있게 한다.
4. 시험형·연습형·복습형 기록을 `learningType`으로 분리한다.
5. 설명 가능한 준비도와 추천 근거를 사용자에게 공개한다.

## 데이터 흐름

```text
answer event
  → cbtAttempts (immutable source event)
  → cbtProgress / cbtPracticeProgress
  → subject/topic statistics
  → weak concepts / SRS / repeated wrong
  → readiness and today's plan
```

## AI 해설 안전 파이프라인

```text
official answerIndex
  → draft generation
  → independent verification
  → answer-index equality check
  → conflict phrase scan
  → question hash
  → HMAC server signature
  → user cache
```

공식 정답과 충돌하거나 근거가 부족하면 해설을 표시하지 않습니다.
