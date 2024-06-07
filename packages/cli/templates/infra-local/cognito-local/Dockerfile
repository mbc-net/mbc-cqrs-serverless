FROM node:18-alpine
WORKDIR /app

COPY ./package.json ./
COPY ./package-lock.json ./
RUN npm install --legacy-peer-deps
COPY . .
EXPOSE 9229
CMD ["npm", "run", "dev"]