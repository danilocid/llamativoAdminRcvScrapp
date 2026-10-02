FROM mcr.microsoft.com/playwright:v1.61.0-noble

WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PORT=8080

# pnpm 11 exige Node >=22.13; la imagen de Playwright trae Node 20, usamos pnpm 10
RUN npm install -g pnpm@10.34.6

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

RUN pnpm exec playwright install chromium

COPY . .

RUN pnpm run build

EXPOSE 8080

CMD ["node", "dist/main.js"]
