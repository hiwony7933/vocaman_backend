# Dockerfile: 보카맨 Node.js 백엔드 애플리케이션용 (Node.js v22 사용, CMD 수정)

# --- 1단계: 빌드 환경 설정 ---
# Node.js 공식 이미지를 기반으로 합니다. v22 버전을 사용합니다.
FROM node:22 AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

# --- 2단계: 운영 환경 설정 ---
FROM node:22

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .

EXPOSE 3000

# 컨테이너 시작 시 실행될 명령어 (쉘 형식으로 변경)
CMD node server.js

