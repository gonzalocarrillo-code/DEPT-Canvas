FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --filter @dept-canvas/renderer... --frozen-lockfile || npm install

COPY . .

CMD ["node", "--import", "tsx", "src/worker.ts"]
