# ==============================
# 1. Frontend build stage
# ==============================

FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Render 환경변수를 Docker build arguments로 받음
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_DATABASE_URL
ARG VITE_FIREBASE_MEASUREMENT_ID
ARG VITE_ADMIN_UIDS

# Vite 빌드 프로세스가 읽도록 환경변수로 전달
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_DATABASE_URL=$VITE_FIREBASE_DATABASE_URL
ENV VITE_FIREBASE_MEASUREMENT_ID=$VITE_FIREBASE_MEASUREMENT_ID
ENV VITE_ADMIN_UIDS=$VITE_ADMIN_UIDS

# 실제 키값은 출력하지 않고 설정 여부만 확인
RUN node -e "console.log({ \
  firebaseApiKey: Boolean(process.env.VITE_FIREBASE_API_KEY), \
  firebaseAuthDomain: Boolean(process.env.VITE_FIREBASE_AUTH_DOMAIN), \
  firebaseProjectId: Boolean(process.env.VITE_FIREBASE_PROJECT_ID), \
  firebaseStorageBucket: Boolean(process.env.VITE_FIREBASE_STORAGE_BUCKET), \
  firebaseSenderId: Boolean(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID), \
  firebaseAppId: Boolean(process.env.VITE_FIREBASE_APP_ID) \
})"

RUN npm run build

# ==============================
# 2. Runtime stage
# ==============================
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist
COPY server ./server

EXPOSE 8787

CMD ["node", "server/server.mjs"]
