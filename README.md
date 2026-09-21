# MakerOS

마이스터고 학생의 목표·일정, 자격증 CBT, PDF 학습자료를 한곳에서 관리하는 웹 앱입니다.

## 로컬 실행

Node.js 22 이상이 필요합니다.

```bash
npm ci
cp .env.example .env
npm run dev
```

`.env`의 Firebase·Gemini·NEIS 값은 사용하는 기능에 맞게 설정하세요. 실제 인증키는 저장소에 올리지 마세요. 화면 개발만 확인할 때에는 `npm run dev:web`을 사용할 수 있습니다.

## 테스트

```bash
npm run check
npm test
npm run build
```

## 배포

`render.yaml`에 정의된 단일 웹 서비스는 `npm run build` 후 `npm start`로 프런트엔드와 API를 함께 제공합니다. 환경변수 목록은 `.env.example` 및 `render.yaml`을 확인하세요. 배포 뒤 `/api/health`로 서버 상태를 확인할 수 있습니다.

Firebase의 Authentication 허용 도메인과 Firestore·Storage 규칙은 실제 배포 도메인에 맞게 설정해야 합니다. `firestore.rules.example`과 `storage.rules.example`은 예시 규칙입니다.

## 데이터 안내

비로그인 기록은 사용자의 브라우저에 저장됩니다. 로그인 후에는 계정에 동기화되며, 헤더에서 저장 상태를 확인할 수 있습니다. CBT 진행 상황은 브라우저의 IndexedDB를 사용하므로 저장소를 삭제하면 기기 기록도 사라집니다.
