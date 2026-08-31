FROM node:20-slim

WORKDIR /app

# Dependências necessárias para build nativo e certificados SSL
RUN apt-get update && apt-get install -y ca-certificates git && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3333

ENV PORT=3333
ENV NODE_ENV=production

CMD ["node", "server.js"]
