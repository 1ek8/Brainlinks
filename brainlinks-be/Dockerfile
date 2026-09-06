# syntax=docker/dockerfile:1

# ---- Stage 1: build TypeScript ----
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Stage 2: runtime ----
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# System deps required by Puppeteer's bundled Chromium
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        fonts-liberation \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libcups2 \
        libdbus-1-3 \
        libdrm2 \
        libgbm1 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libx11-6 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxkbcommon0 \
        libxrandr2 \
        libxshmfence1 \
        libxss1 \
        xdg-utils \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Pre-bundle the local embedding model into the image so cold starts
# don't download it at runtime (Cloud Run has no persistent disk).
RUN mkdir -p /root/.cache \
    && node -e 'const { pipeline } = require("@xenova/transformers"); pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2").then(p => { console.log("model cached OK"); process.exit(0); }).catch(e => { console.error("model preload failed:", e.message); process.exit(1); });'

EXPOSE 8080
CMD ["node", "dist/index.js"]