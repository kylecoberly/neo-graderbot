FROM node:22-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3200
CMD ["pnpm", "exec", "next", "start", "-H", "0.0.0.0", "-p", "3200"]
