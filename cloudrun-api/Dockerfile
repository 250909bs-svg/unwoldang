FROM node:20-slim AS build
WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY src ./src
COPY api ./api
COPY cloudrun-api ./cloudrun-api

RUN npx esbuild cloudrun-api/src/index.ts --bundle --platform=node --target=node20 --format=esm --outfile=cloudrun-api/dist/index.js

FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=build /workspace/cloudrun-api/dist/index.js ./index.js

EXPOSE 8080

CMD ["node", "index.js"]
