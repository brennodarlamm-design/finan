FROM node:20-slim

WORKDIR /app

# Dependências necessárias para build nativo e certificados SSL
RUN apt-get update && apt-get install -y ca-certificates git && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --production

COPY . .

# Patch 22: hardening do gateway WhatsApp.
RUN git apply --check -p2 patch22-server.diff \
    && git apply -p2 patch22-server.diff \
    && rm -f patch22-server.diff

# Patch 23: limites de mídia, phone explícito e restart seguro em erro fatal.
RUN git apply --check -p2 patch23-server.diff \
    && git apply -p2 patch23-server.diff \
    && rm -f patch23-server.diff

EXPOSE 3333

ENV PORT=3333
ENV NODE_ENV=production

CMD ["node", "server.js"]
