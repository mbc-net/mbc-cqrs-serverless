FROM node:18-alpine
WORKDIR /app

COPY ./package.json ./
COPY ./package-lock.json ./
RUN npm install --legacy-peer-deps
COPY . .
EXPOSE 9229

# Generate config.json with correct IssuerDomain at startup
# COGNITO_ISSUER_DOMAIN can be set via docker-compose environment
CMD sh -c 'mkdir -p /app/.cognito && \
  echo "{\"TokenConfig\":{\"IssuerDomain\":\"${COGNITO_ISSUER_DOMAIN:-http://localhost:9229}\"}}" > /app/.cognito/config.json && \
  npm run dev'