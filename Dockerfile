FROM mcr.microsoft.com/playwright:v1.61.0-noble

WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PORT=8080

COPY package*.json ./

RUN npm ci

RUN npx playwright install chromium

COPY . .

RUN npm run build

EXPOSE 8080

CMD ["node", "dist/main.js"]
