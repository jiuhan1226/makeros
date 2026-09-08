# MakerOS

> **문제를 푸는 앱에서, 반복을 관리하는 AI 학습 운영체제로.**

MakerOS는 직업계고·자격증 학습자의 기출문제 풀이, 자기평가, 반복 오답, 복습 주기, PDF 학습자료와 AI 해설을 연결하여 **오늘 무엇을 공부해야 하는지 안내하는 학습 운영 플랫폼**입니다.

- 서비스 URL: `https://makeros.onrender.com/`
- GitHub URL: `https://github.com/jiuhan1226/makeros/tree/main`
- 3분 피치 영상: `<YouTube URL>`

---

## 1. 문제정의

대부분의 CBT 서비스는 다음 과정에서 끝납니다.

```text
문제 풀이 → 점수 확인 → 종료
```

하지만 실제 시험 준비에서는 다음 과정이 반복되어야 합니다.

```text
틀린 이유 확인
→ 이해도 자기평가
→ 적절한 시점에 복습
→ 반복 오답과 취약 개념 보완
→ 실전 문제로 검증
```

직업계고와 자격증 학습자는 기출문제, PDF 교재, 오답노트와 AI 서비스를 각각 다른 환경에서 사용합니다.

이 때문에 다음과 같은 문제가 발생합니다.

- 맞힌 문제를 실제로 이해했는지 확인하기 어렵습니다.
- 언제 어떤 문제를 다시 복습해야 하는지 알기 어렵습니다.
- 반복해서 틀린 문제와 취약 개념을 체계적으로 관리하기 어렵습니다.
- 범용 AI가 공식 정답과 다른 해설을 생성할 수 있습니다.
- CBT와 PDF 학습 기록이 분리되어 다음 학습 행동으로 연결되지 않습니다.

MakerOS는 정오답뿐 아니라 학생의 이해도와 반복 학습 과정을 함께 기록하여 다음 학습 행동을 자동으로 구성합니다.

### 핵심 해결 방식

#### 자기평가

문제의 정오답과 함께 다음 이해도 중 하나를 기록합니다.

- 확실함
- 애매함
- 모름

정답을 맞혔더라도 이해도가 낮으면 복습 대상으로 유지합니다.

#### SRS 자동 복습

정오답, 자기평가, 복습 횟수와 반복 성공 여부를 바탕으로 다음 복습일을 계산합니다.

#### 반복 오답 관리

2회 이상 틀린 문제를 별도로 분류하여 집중 복습 대상으로 제공합니다.

#### 세부 주제 분석

과목보다 작은 주제 단위로 정답률, 풀이 횟수와 반복 오답을 분석합니다. 데이터가 지나치게 적은 주제는 유사한 상위 주제로 통합합니다.

#### 검증된 AI 해설

공식 정답을 고정한 상태에서 생성과 검증을 분리합니다.

```text
공식 answerIndex 고정
→ 1차 AI 해설 생성
→ 독립적인 2차 검증
→ 코드 정답 대조
→ 충돌 문구 검사
→ HMAC 서명
→ 해설 표시
```

검증 과정 중 하나라도 실패하면 AI 해설을 표시하지 않고 공식 정답만 유지합니다.

#### 시험 준비도

시험 준비도는 다음 요소를 기준으로 계산합니다.

- 기출 범위: 35점
- 회차 확보: 25점
- 숙련도: 25점
- 실전 검증: 15점

준비도 점수와 함께 각 구성 요소의 계산 근거를 제공합니다.

#### 오늘의 학습

다음 데이터를 바탕으로 일일 학습 목표와 우선순위를 추천합니다.

- 복습 예정 문제
- 반복 오답
- 취약 주제
- 시험일까지 남은 기간
- 최근 7일 학습량

#### PDF 학습 연결

업로드한 PDF를 반복 학습 자료로 변환합니다.

```text
PDF 업로드
→ AI 노트
→ 플래시카드
→ Learning Tree
→ AI Tutor
```

각 학습 자료는 동일한 문서 ID와 컨텍스트를 유지합니다.

---

## 2. 아키텍처

MakerOS는 프런트엔드, 학습 엔진, Firebase와 AI API 서버로 구성됩니다.

```text
React + Vite
  ├─ Home
  ├─ CBT
  ├─ PDF 학습
  ├─ AI Tutor
  ├─ 학습 코치
  ├─ 성장 리포트
  └─ 학습 플래너

Deterministic Learning Engine
  ├─ 정오답 채점
  ├─ 미응답 문제 제외
  ├─ 자기평가 기록
  ├─ SRS 복습일 계산
  ├─ 반복 오답 분석
  ├─ 세부 주제 취약도 분석
  ├─ 시험 준비도 계산
  └─ 일일 권장량 계산

Firebase
  ├─ Authentication
  ├─ Firestore
  └─ Storage

Express API
  ├─ Firebase ID Token 검증
  ├─ Gemini API 연동
  ├─ Origin Allowlist
  ├─ Rate Limiting
  └─ AI 해설 안전 파이프라인
```

### AI와 결정 가능한 코드의 역할 분리

다음 항목은 AI가 아닌 코드에서 계산합니다.

- 공식 정답 채점
- 점수와 합격 여부
- 미응답 문제 제외
- 복습 예정일
- 반복 오답
- 숙련 단계
- 시험 준비도
- 일일 권장 문제 수

AI는 다음과 같이 언어 생성과 맥락 이해가 필요한 영역에 사용합니다.

- CBT 해설 생성
- 취약 개념 설명
- PDF 노트와 플래시카드 생성
- Learning Tree 생성
- AI Tutor 응답
- 학습 코칭
- 발명 아이디어 구조화

### 학습 데이터 구조

각 문제 풀이는 `attemptId`를 기준으로 원본 이벤트로 저장합니다.

```text
사용자 문제 풀이
→ CBTAttempt 원본 이벤트 저장
→ QuestionProgress 갱신
→ 과목·주제 통계 재계산
→ SRS·반복 오답 생성
→ 오늘의 학습 추천
```

원본 이벤트와 집계 데이터를 분리하여 중복 집계나 통계 오류 발생 시 다시 계산할 수 있도록 설계했습니다.

### 반응형 구조

- 데스크톱: 문제와 고정 답안지, 해설 영역 제공
- 태블릿: 문제와 OMR·필기 노트 분할
- 휴대폰: 전체 화면 CBT와 하단 OMR 시트
- 입력 지원: 마우스, 손가락, Apple Pencil, S Pen
- 최소 화면 너비: 320px
- iPhone 안전 영역 대응

자세한 시스템 구조는 [ARCHITECTURE.md](./ARCHITECTURE.md)에서 확인할 수 있습니다.

---

## 3. 사용 스택

### Frontend

- React 18
- Vite 6
- CSS
- Firebase Client SDK
- PDF.js

### Backend

- Node.js 22
- Express

### Database / Authentication / Storage

- Firebase Authentication
- Cloud Firestore
- Firebase Storage

### AI

- Google Gemini SDK

### Security

- Firebase ID Token Verification
- Helmet
- CORS Allowlist
- Rate Limiting
- Question Hash
- HMAC Signature

### Deployment

- Docker
- Render

### Test

- Node.js Test Scripts
- JSX·TypeScript Syntax Validation
- Vite Production Build
- Responsive Test Scripts

---

## 4. 실행방법

### 필수 환경

- Node.js 22.x
- npm
- Firebase 프로젝트
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Google Gemini API Key

Node.js 버전을 확인합니다.

```bash
node -v
```

```text
v22.x.x
```

### 저장소 설치

```bash
git clone <GitHub 저장소 URL>
cd <저장소 폴더명>
npm install
```

### 환경변수 설정

`.env.example`을 복사해 `.env` 파일을 생성합니다.

```bash
cp .env.example .env
```

Windows PowerShell에서는 다음 명령을 사용할 수 있습니다.

```powershell
Copy-Item .env.example .env
```

`.env` 파일에 Firebase와 Gemini 관련 환경변수를 설정합니다.

API Key와 HMAC 서명 Key 등 서버 전용 값에는 `VITE_` 접두사를 사용하지 않습니다.

### 개발 서버 실행

```bash
npm run dev
```

기본 개발 주소는 다음과 같습니다.

- Web: `http://localhost:5173`
- API: `http://localhost:8787`

### 테스트

```bash
npm run test
```

반응형 화면 테스트는 다음 명령으로 실행합니다.

```bash
npm run test:responsive
```

### 코드 검사

```bash
npm run check
```

### 프로덕션 빌드

```bash
npm run build
```

### 프로덕션 실행

```bash
npm start
```

배포 설정은 다음 파일에서 확인할 수 있습니다.

- `Dockerfile`
- `render.yaml`
- `DEPLOY_RENDER.md`

---

## 5. AI 사용 내역

### 제품에서 사용한 AI

MakerOS는 Google Gemini API를 다음 기능에 사용합니다.

- 공식 정답 기반 CBT 해설 초안 생성
- CBT 해설 독립 2차 검증
- 취약 개념 학습 가이드 생성
- PDF AI 노트 생성
- PDF 플래시카드 생성
- Learning Tree 생성
- 선택한 CBT 또는 PDF 범위 기반 AI Tutor
- 학습 기록 기반 학습 코치
- 발명 아이디어 구조화

### AI 해설 안전 구조

AI가 공식 정답을 변경하거나 임의로 결정하지 못하도록 공식 `answerIndex`를 입력과 출력에서 고정합니다.

생성된 해설은 다음 조건을 모두 통과한 경우에만 표시합니다.

1. 1차 생성 결과가 공식 정답과 일치해야 합니다.
2. 별도의 2차 검증 결과가 공식 정답과 일치해야 합니다.
3. 코드 검사에서 정답 번호가 일치해야 합니다.
4. 정답과 충돌하는 표현이 없어야 합니다.
5. 문제 해시와 HMAC 서명이 유효해야 합니다.

조건을 충족하지 못한 해설은 저장하거나 표시하지 않습니다.

### 개발 과정에서 사용한 AI

개발 과정에서 다음 AI 도구를 보조적으로 사용했습니다.

#### ChatGPT / OpenAI

- 제품 요구사항 정리
- 코드 리뷰
- 오류 원인 분석
- UI 문구 개선
- 테스트 시나리오 작성
- 문서 구조화

#### Google Gemini

- 실제 서비스 AI 기능 구현
- 구조화된 JSON 응답 생성
- CBT 해설 생성과 검증
- PDF 학습자료 생성

AI가 생성한 코드와 문서는 팀이 직접 실행하고 검토한 뒤 수정했습니다.

공식 정답, 점수, 복습일, 시험 준비도와 일일 권장량은 AI가 아니라 코드에서 계산합니다.

자세한 AI 사용 내역은 [AI_USAGE_DISCLOSURE.md](./AI_USAGE_DISCLOSURE.md)에서 확인할 수 있습니다.

---

## 6. 라이선스

이 저장소에서 팀이 자체 작성한 코드는 [MIT License](./LICENSE)로 공개합니다.

외부 라이브러리는 각 라이브러리의 원 라이선스를 따릅니다.

기출문제, PDF, 이미지와 학습 데이터는 저장소의 MIT License에 포함되지 않으며, 각 자료의 저작권과 이용 조건을 따라야 합니다.

권리 확인이 되지 않은 기출문제, PDF와 이미지는 공개 저장소에 포함하지 않습니다.
