FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY expo-app/package.json expo-app/package.json
COPY server/package.json server/package.json
RUN npm ci && mkdir -p /app/server/node_modules
COPY shared shared
COPY scripts scripts
COPY expo-app expo-app
COPY server server
RUN npm run build:web && npm run build --workspace server

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/prisma ./server/prisma
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/expo-app/dist ./expo-app/dist
ENV NODE_ENV=production
ENV WEB_DIR=/app/expo-app/dist
ENV PORT=5000
WORKDIR /app/server
USER node
EXPOSE 5000
CMD ["node", "dist/server/index.js"]
