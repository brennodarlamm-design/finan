# Auditoria de SEO, AEO e GEO — 03/10/2026

- **SEO:** aparecer no Google e no Bing.
- **AEO** (Answer Engine Optimization): ser a resposta direta em buscas por voz, "featured snippets" e na Visão Geral com IA do Google.
- **GEO** (Generative Engine Optimization): ser citado por ChatGPT, Perplexity, Claude e Gemini.

**Método:** análise do código que vai ao ar: páginas HTML, `robots.txt`, `sitemap.xml`, JSON-LD, `llms.txt`/`llms-full.txt`, roteamento do Worker e build. O site em produção não estava acessível a partir do ambiente da auditoria, então desempenho real (Core Web Vitals) e indexação no Search Console ficam para checagem manual.

## Nota geral

| Área | Situação |
|---|---|
| Base técnica (robots, sitemap, canonical, metatags, OG) | 🟢 boa |
| Dados estruturados (JSON-LD) | 🟢 boa na home, 🟡 incompleta no resto |
| **Conteúdo visível para robôs** | 🔴 **crítico**: 5 páginas principais chegam vazias |
| Blog e conteúdo de autoridade | 🔴 fraco: sem URL por artigo e artigos curtos |
| Material para IAs (llms.txt) | 🟠 tinha informações erradas; corrigido nesta auditoria |
| Autoridade da marca (E-E-A-T, menções externas) | 🟠 pouca prova de quem está por trás |

## O que está bom

- `robots.txt` bloqueia app, login, master e API, permite busca e uso por IA (`Content-Signal: search=yes, ai-input=yes`) e proíbe treino (`ai-train=no`).
- Canonical, `robots index,follow`, Open Graph e Twitter Card nas páginas públicas. O login tem `noindex`.
- A home tem JSON-LD completo: WebSite, Organization, SoftwareApplication (com ofertas de R$ 119,90 a R$ 499,90), BreadcrumbList e FAQPage.
- A **Calculadora de BDI** é o melhor ativo do site: 457 palavras no HTML, WebApplication + FAQPage, tema de alta procura. Serve de modelo para as outras páginas.
- O Worker entrega markdown para agentes que pedem `Accept: text/markdown`, e há catálogo de IA em `/.well-known/ai-catalog.json`.

## Problemas encontrados

### 🔴 1. As páginas principais chegam vazias para robôs
`landing`, `planos`, `sobre-nos`, `blog` e `manuais` só têm `<div id="root"></div>`. Todo o texto é montado pelo React no navegador.

| Página | Palavras no HTML |
|---|---|
| Home, Planos, Sobre, Blog, Manuais | **0** |
| Calculadora BDI | 457 |
| Termos / Privacidade | ~1.100 |

- **Google:** renderiza o JavaScript, mas numa segunda fila, mais lenta e menos confiável. Títulos e descrições ajudam, mas o conteúdo pesa pouco.
- **GPTBot, ClaudeBot, PerplexityBot e Bing (em boa parte):** **não executam JavaScript**. Para eles, essas páginas não têm conteúdo. É o maior bloqueio de GEO do site.

**Correção recomendada:** pré-renderizar as páginas no build (SSG). Gerar o HTML de cada rota com `react-dom/server` e hidratar no navegador. Como alternativa mais simples, colocar no `#root` um conteúdo estático gerado a partir dos mesmos dados (planos, FAQ, artigos, manuais), que o React substitui ao carregar.

### 🔴 2. Blog sem página por artigo e com textos curtos
- Os 6 artigos abrem por `#hash` dentro de `/blog`. Para o Google e as IAs, é **uma página só**; os artigos não têm URL própria, não entram no sitemap e não podem ser citados.
- Cada artigo tem de **127 a 214 palavras**. Para disputar "como calcular BDI" ou "retenção de INSS em medição", o padrão é de 1.000 a 2.000 palavras, com tabela, exemplo numérico e fontes.
- Datas em texto ("21 Setembro 2026"), sem autor e sem schema `BlogPosting`.

**Correção:** `/blog/<slug>` com HTML próprio e `BlogPosting` (autor, `datePublished` ISO, imagem), artigos de 1.000 palavras ou mais, com autor identificado (engenheiro com CREA) e links para as normas.

### 🟠 3. `llms.txt` e `llms-full.txt` com informações erradas — **corrigido**
- Apontavam para `/app#…` e `/api` (exigem login ou são bloqueados).
- Citavam "Vercel" (banida) e "Baileys" (o WhatsApp hoje usa Evolution Go).
- Chamavam o `/validar` de validação "padrão ICP-Brasil", mas ele confere a assinatura interna do FinGo, não um certificado ICP.
- O `llms-full.txt` descrevia rotas, banco (`empresa_id INT`) e CSP que não existem. Isso dava informação errada às IAs e um mapa de ataque a terceiros.

**Feito:** os dois arquivos foram reescritos com fatos conferidos no código: planos e limites de `api/_plans.js`, teste de 15 dias, recursos reais e distinção correta entre assinatura simples, avançada (Gov.br) e qualificada (ICP-Brasil). O `llms-full.txt` virou guia de conhecimento no formato que IAs citam: resposta curta, fórmula do BDI do TCU, faixas de referência, SINAPI desonerado x não desonerado, retenções com base legal e FAQ.

### 🟠 4. Autoridade da marca (E-E-A-T) e entidade
- A `Organization` não tem `sameAs` (LinkedIn, Instagram, YouTube, Google Meu Negócio). As IAs usam isso para saber que "FinGo" é a mesma entidade em todo lugar.
- "Sobre nós" é curta: faltam razão social, CNPJ, cidade, quem fundou e equipe técnica. Para software financeiro, Google e IAs valorizam provas de quem responde pelo produto.
- Nenhuma menção ou avaliação externa referenciada (Capterra, B2B Stack, G2, Reclame Aqui). GEO depende muito de **ser citado em outros sites**.

### 🟡 5. Itens menores
| Item | Situação |
|---|---|
| `sitemap.xml` sem `/blog` e `/manuais` (permitidos no robots) | **Corrigido** (11 URLs) |
| `robots.txt`: `Disallow: /portal/` não bloqueava `/portal?...` (link do portal do cliente) | **Corrigido** para `Disallow: /portal` |
| Títulos curtos: "Planos e preços \| FinGo", "Sobre nós \| FinGo" | **Corrigido**: "Planos e Preços do Sistema de Obra \| FinGo", "Sobre o FinGo — Sistema de Gestão de Obras para Construtoras" |
| Sobre-nós sem JSON-LD | **Corrigido**: AboutPage + BreadcrumbList |
| Markdown para agentes: títulos do blog diferentes dos reais e "Assinatura ICP-Brasil" no plano Profissional | **Corrigido** |
| Imagem OG com 690 KB e logo do schema com 560 KB | Pendente: otimizar para menos de 150 KB (WebP/JPEG 80%) |
| FAQPage: o Google só mostra o rich result para sites de governo e saúde desde 2023 | Manter: as IAs leem e usam para respostas |
| Core Web Vitals (LCP/INP/CLS) | Medir no PageSpeed Insights depois do deploy, sobretudo o bundle React da home |

## Plano de melhorias (ordem de impacto)

| # | Ação | Impacto | Esforço |
|---|---|---|---|
| 1 | ✅ **Feito** — Pré-renderizar landing, planos, sobre, blog e manuais (HTML com o conteúdo) | 🔴 muito alto (SEO e GEO) | médio |
| 2 | ✅ **Feito** — Uma página por artigo (`/blog/<slug>`) com `BlogPosting` e data, no sitemap e no llms.txt (autor ainda é a organização) | 🔴 alto | baixo/médio |
| 3 | ✅ **Feito** — Reescrever os 6 artigos: resposta direta no topo, subtítulos, tabelas, exemplo numérico, FAQ e fontes (580 a 1.140 palavras) | 🔴 alto | médio (conteúdo) |
| 4 | Novas páginas-resposta para buscas fortes: "planilha de medição de obra", "como calcular retenção de INSS 11%", "BDI para obra particular", "sistema de gestão de obras para MCMV", "orçamento SINAPI por estado" | 🟠 alto | médio |
| 5 | `sameAs` na Organization e perfil no Google Meu Negócio, LinkedIn e YouTube | 🟠 médio | baixo (preciso dos links reais) |
| 6 | Sobre-nós com empresa, CNPJ, cidade, fundadores e responsável técnico | 🟠 médio | baixo |
| 7 | Cadastro em Capterra, B2B Stack, G2 e Google, com avaliações de clientes reais | 🟠 médio (GEO) | contínuo |
| 8 | Otimizar imagens OG e logo | 🟡 baixo | baixo |
| 9 | Medir Core Web Vitals e reduzir o JS da home | 🟡 médio | médio |

## Aplicado em 03/10/2026 (itens 1 e 2)

- `scripts/prerender-marketing.mjs`, chamado no fim do `scripts/build-marketing.js`, compila `marketing/main.jsx` para SSR, renderiza cada rota com `react-dom/server` e injeta o HTML no `#root`. No navegador o React substitui esse HTML pelo mesmo conteúdo.

  | Página | Palavras no HTML: antes → depois |
  |---|---|
  | Home | 0 → ~900 |
  | Planos | 0 → ~460 |
  | Sobre | 0 → ~280 |
  | Manuais | 0 → ~750 |
  | Blog | 0 → ~480 |

- **Artigos com página própria:** `/blog/<slug>` (6 páginas), cada uma com título, descrição, canonical, Open Graph, JSON-LD `BlogPosting` (data ISO) e `BreadcrumbList`. Os links antigos `/blog#slug` redirecionam para a URL nova.
- **Worker:** serve `/blog/<slug>` (só slugs `a-z0-9-`). **Sitemap:** 17 URLs.
- **Testes:** `scripts/test-seo-prerender.js`. Também conferido no Chromium com o servidor do Vite: navegação, redirecionamento do hash antigo e nenhum erro de JavaScript.

## Aplicado em 03/10/2026 (item 3: blog)

- **Artigos reescritos** em `marketing/blog-data.js` com blocos estruturados (subtítulos, listas, passos, tabelas, fórmula, destaque), resposta curta no topo, FAQ e fontes.

  | Artigo | Palavras: antes → depois |
  |---|---|
  | BDI pelo TCU | 214 → ~1.140 |
  | Retenções INSS/ISS | ~180 → ~960 |
  | SINAPI desonerado | ~170 → ~830 |
  | Conciliação OFX | ~150 → ~610 |
  | NF-e e OCR | ~140 → ~610 |
  | BIM e clash | ~130 → ~580 |

- **Erros corrigidos:** no BDI, Seguro e Garantia aparecem juntos (S+G) e o Risco médio é 1,27%, como no TCU. O texto ganhou o BDI final de referência (20,34% a 25,00%) e um exemplo com a conta passo a passo. Nas retenções, a regra do CPOM foi apresentada como exemplo de São Paulo, entraram a base legal, a alíquota de 3,5% da CPRB e a regra da empreitada total. No SINAPI, entrou a reoneração gradual da Lei 14.973/2024. No BIM, ficou claro que a detecção de interferências só vale sobre modelos reais.
- **Schema do artigo:** `BlogPosting` com `dateModified` e `wordCount`, além de `FAQPage`. A página mostra autor e data de atualização. O sitemap passou a usar a data de atualização. O `llms-full.txt` foi alinhado com os artigos.
- **Revisão pendente:** as alíquotas, as faixas do TCU e as regras de retenção precisam passar por um engenheiro e um contador antes de entrar no ar. A Calculadora de BDI ainda considera a CPRB de 4,5%, sem a transição de 2025 a 2027.

## Como medir depois

- **Google Search Console:** páginas indexadas, consultas e cobertura. Enviar o sitemap de novo.
- **Bing Webmaster Tools:** importante para GEO, porque o ChatGPT usa o índice do Bing.
- **Teste rápido de GEO:** perguntar ao ChatGPT, Perplexity e Gemini "qual o melhor sistema de gestão de obras para construtora pequena?" e "como calcular BDI pelo TCU?", e anotar se o FinGo aparece e com que fonte.
- **Robô sem JavaScript:** `curl -A "GPTBot" https://fingo.api.br/planos` deve mostrar os planos no HTML depois da melhoria 1.
