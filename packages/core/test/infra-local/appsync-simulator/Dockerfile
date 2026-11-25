FROM node:22-alpine
WORKDIR /app

COPY ./package.json ./
COPY ./package-lock.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "serve"]