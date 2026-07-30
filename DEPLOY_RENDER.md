# MakerOS v0.12 Render 배포 가이드

이 버전은 Vite 프론트엔드와 Express API를 하나의 Render Web Service에서 제공합니다.

## 1. GitHub 업로드

```bash
git init
git add .
git commit -m "Deploy MakerOS v0.12"
git branch -M main
git remote add origin <GitHub 저장소 주소>
git push -u origin main
```

`.env`, `node_modules`, `dist`는 업로드하지 않습니다.

## 2. Render Blueprint 배포

1. Render Dashboard에서 **New → Blueprint**를 선택합니다.
2. GitHub 저장소를 연결합니다.
3. 저장소의 `render.yaml`을 확인하고 배포합니다.
4. 환경변수를 등록합니다.

필수:

- `GEMINI_API_KEY`
- `EXPLANATION_SIGNING_SECRET`
- `FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

선택:

- `VITE_ADMIN_UIDS`
- `ALLOWED_ORIGINS`
- `AI_EXPLANATION_USER_DAILY_LIMIT`
- `AI_EXPLANATION_FORCE_RETRY_DAILY_LIMIT`

`ALLOW_UNAUTHENTICATED_AI`는 운영 환경에서 `false`를 유지하세요.

## 3. Firebase 설정

Firebase Authentication의 Authorized domains에 Render 도메인을 추가합니다.

```text
makeros.onrender.com
```

`firestore.rules.example`을 참고해 보안 규칙을 배포합니다. 관리자 검토함을 사용하려면 관리자 계정에 custom claim `admin=true`를 설정하는 방식을 권장합니다.

## 4. 배포 확인

```text
https://<Render 도메인>/api/health
```

정상 응답에는 다음 항목이 포함됩니다.

```json
{
  "ok": true,
  "version": "0.12.0-launch-copy",
  "apiKeyConfigured": true,
  "firebaseTokenVerificationConfigured": true,
  "signedExplanationCacheConfigured": true
}
```

## 5. 수동 Web Service 설정값

- Runtime: Node
- Node Version: `22`
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Health Check Path: `/api/health`

## 6. 로컬에서 배포 형태 테스트

```bash
npm install
npm run test
npm run build
npm start
```

브라우저에서 `http://localhost:8787`에 접속합니다.
