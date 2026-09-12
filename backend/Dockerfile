FROM node:20-slim

WORKDIR /app

# Dependências necessárias para certificados SSL e dependências Node.
RUN apt-get update && apt-get install -y ca-certificates git && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --production

# Patch 27: o código de produção já é materializado e versionado no repositório.
# O container não aplica diffs em server.js durante o build.
COPY . .

EXPOSE 3333

ENV PORT=3333
ENV NODE_ENV=production

CMD ["node", "server.js"]
