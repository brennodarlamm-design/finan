FROM node:20-slim

WORKDIR /app

# Certificados SSL necessários para conexões HTTPS.
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

# A fonte de produção já é materializada e versionada no repositório.
COPY . .

EXPOSE 3333

ENV PORT=3333
ENV NODE_ENV=production

CMD ["node", "server.js"]
