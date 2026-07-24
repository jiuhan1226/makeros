# MakerOS Render 배포 가이드

이 버전은 Vite 프론트엔드와 Express API를 하나의 Render Web Service에서 제공합니다.

## 1. GitHub 업로드

```bash
git init
git add .
git commit -m "Deploy MakerOS v0.6"
git branch -M main
git remote add origin <GitHub 저장소 주소>
git push -u origin main
```

`.env`, `node_modules`, `dist`는 업로드하지 않습니다.

## 2. Render Blueprint 배포

1. Render Dashboard에서 **New → Blueprint**를 선택합니다.
2. GitHub 저장소를 연결합니다.
3. 저장소의 `render.yaml`을 확인하고 배포합니다.
4. 환경변수 입력 화면에서 다음 값을 등록합니다.

필수:
- `GEMINI_API_KEY`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

선택:
- `VITE_ADMIN_UIDS`
- `ALLOWED_ORIGINS` — 통합 배포만 사용할 때는 비워도 됩니다.

## 3. Firebase 설정

Firebase Authentication의 Authorized domains에 Render 도메인을 추가합니다.

예:

```text
makeros.onrender.com
```

Firestore와 Storage 보안 규칙도 공개 배포 전에 로그인 사용자 및 소유자 기준으로 제한해야 합니다.

## 4. 배포 확인

다음 주소에서 서버 상태를 확인합니다.

```text
https://<Render 도메인>/api/health
```

정상 응답 예시:

```json
{
  "status": "ok",
  "service": "MakerOS",
  "version": "0.6.0-deploy",
  "aiConfigured": true
}
```

그다음 홈 화면, CBT, PDF, AI 노트, Learning Tree, AI Tutor, Invent, Project, Portfolio 순서로 확인합니다.

## 5. 수동 Web Service 설정값

Blueprint를 사용하지 않을 경우:

- Runtime: Node
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Health Check Path: `/api/health`

## 6. 로컬에서 배포 형태 테스트

```bash
npm install
npm run build
npm start
```

브라우저에서 `http://localhost:8787`에 접속합니다.
