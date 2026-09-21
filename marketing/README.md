# Landing FinGo — React + Vite + Tailwind

Desenvolvimento: `npm run dev:landing`. Rotas: `/`, `/planos`, `/sobre-nos`.
Teste no navegador: `npm run test:landing` (instalar Chromium com `npx playwright install chromium`).
A área autenticada continua usando seu pipeline existente.

Design: industrial editorial, identidade FinGo, tipografia compacta, fundo escuro e verde ácido. DFII: 13 (4+5+5+4−5).
Tokens de cor e tipografia ficam em `marketing/styles.css`. Vídeos em loop sem controles de pausa visíveis; respeitam a preferência de movimento reduzido.
Preços, limites e recursos vêm de `api/_plans.js`; não duplicar valores no frontend.

Distribuição: `npm run build:landing` gera os três HTML e bundles em `.marketing-dist`, copiando para `dist` (ou raiz na Vercel). Integrado ao build Cloudflare existente. **Executar somente depois de testes, commit e push**, conforme AGENTS.md. `npm install --ignore-scripts` permite instalar dependências sem disparar o postinstall de distribuição.

## Vídeo

Cena: Man in hard hat watching drone fly — Mixkit, item 600, Edgar Fernández.
Fonte: https://mixkit.co/free-stock-video/man-in-hard-hat-watching-drone-fly-600/
Licença indicada na página: Mixkit Stock Video Free License, uso comercial/pessoal permitido.
Licença: https://mixkit.co/license/#videoFree
Obtido em 2026-09-20. Arquivos locais `img/fingo/construction-background.mp4` e `.jpg` (poster fornecido pelo catálogo).
Sem áudio, loop e playsInline. O navegador pode bloquear autoplay; nesse caso, permanece o poster como imagem estática. Movimento reduzido não inicia o vídeo automaticamente.
