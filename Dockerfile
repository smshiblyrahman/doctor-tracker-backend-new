# One image definition for every backend service: docker build --build-arg SERVICE=doctor-service .
# Context is /backend so npm workspaces (and the shared @doctor-tracker/common package) resolve.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/common/package.json packages/common/
COPY api-gateway/package.json api-gateway/
COPY auth-service/package.json auth-service/
COPY doctor-service/package.json doctor-service/
COPY patient-service/package.json patient-service/
COPY dashboard-service/package.json dashboard-service/
RUN npm ci --ignore-scripts

FROM deps AS build
ARG SERVICE=api-gateway
COPY . .
RUN npm run build

FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/api-gateway/package.json api-gateway/
COPY --from=deps /app/auth-service/package.json auth-service/
COPY --from=deps /app/doctor-service/package.json doctor-service/
COPY --from=deps /app/patient-service/package.json patient-service/
COPY --from=deps /app/dashboard-service/package.json dashboard-service/
RUN npm ci --omit=dev --ignore-scripts

FROM node:22-alpine
ARG SERVICE=api-gateway
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/ .
USER node
CMD ["node", "dist/server.unified.js"]
