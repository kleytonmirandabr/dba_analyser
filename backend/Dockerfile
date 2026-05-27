# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production stage
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production && npm cache clean --force
COPY --from=builder /app/dist ./dist
EXPOSE 3030
USER node
CMD ["node", "dist/index.js"]
