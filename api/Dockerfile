# Build from the repository root, because the API compiles shared files from lib/:
#   docker build -f api/Dockerfile -t kachabity-api .
FROM node:22-alpine AS build
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci
COPY lib /app/lib
COPY api ./
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/api/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/api/src/main.js"]
