FROM mcr.microsoft.com/playwright:v1.61.0-noble

WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PORT=8080

RUN npm install -g pnpm@11.1.3

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

RUN pnpm exec playwright install chromium

COPY . .

RUN pnpm run build

EXPOSE 8080

CMD ["node", "dist/main.js"]
