FROM node:20-bullseye-slim AS builder

# RUN apk update
# RUN apk --no-cache add make gcc g++ --virtual .builds-deps build-base python3 musl-dev openssl-dev

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npm run build:prod

FROM node:20-bullseye-slim

# RUN apk update
# RUN apk --no-cache add make gcc g++ --virtual .builds-deps build-base python3 musl-dev openssl-dev

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# COPY .env .env

CMD ["npm", "run", "start:prod"]
