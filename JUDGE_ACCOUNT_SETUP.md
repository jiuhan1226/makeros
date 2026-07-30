# 심사 계정 설정 가이드

심사 계정은 제품 안에서 별도로 표시되는 데모 모드가 아니라, 학습 기록이 미리 준비된 **일반 사용자 계정**입니다.

## 1. Firebase 준비

- Firebase Authentication에서 이메일/비밀번호 로그인을 활성화합니다.
- Firestore에 `certificates`, `cbtExams`, `cbtQuestions` 데이터가 등록되어 있어야 합니다.

## 2. 로컬 `.env` 설정

```env
DEMO_ACCOUNT_EMAIL=judge-demo@example.com
DEMO_ACCOUNT_PASSWORD=6자_이상의_비밀번호
DEMO_CERTIFICATE_ID=Firestore_certificates_문서_ID
```

`VITE_` 접두사를 붙이지 마세요. 계정 비밀번호가 프런트엔드 번들에 포함될 수 있습니다.

## 3. 계정과 학습 데이터 생성

```bash
npm run seed:judge
```

이미 같은 이메일의 계정이 있으면 로그인한 뒤 학습 데이터를 기준 상태로 다시 구성합니다.

## 4. 심사위원 전달

- 제품 URL
- 이메일
- 비밀번호

위 정보는 공개 README나 GitHub가 아니라 온라인 신청서의 심사 안내란 또는 운영진에게 제공하는 비공개 문서로 전달합니다.

## 5. 제품 접속

심사위원은 제품의 일반 `로그인` 버튼을 눌러 이메일과 비밀번호를 입력합니다. 별도의 데모 버튼이나 심사용 화면은 없습니다. 로그인 후 `학습` 메뉴를 열면 seed에서 지정한 자격증과 누적 학습 기록을 확인할 수 있습니다.

## 6. 기준 상태 복원

심사 과정에서 데이터가 변경된 경우 아래 명령을 다시 실행합니다.

```bash
npm run seed:judge
```
