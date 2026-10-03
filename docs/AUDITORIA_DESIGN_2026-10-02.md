# Auditoria de Design — FinGo (02/10/2026)

Protocolo: `.agents/skills/ui-ux-audit` + `bencium-design-audit` (formato de `references/audit-template.md`).
Referência de marca: `.agents/skills/fingo-brand-system/SKILL.md` e `brand/fingo/tokens.json`.
Mecânica: `.agents/skills/design-system`, `kpi-dashboard-design`, `frontend-design`.

Escopo: só visual. Nenhuma alteração de lógica, API ou dados. Nada foi implementado — este documento é o plano para aprovação.

Método: leitura de `css/tokens.css`, `css/style.css`, `css/premium.css`, `css/startup.css`, `css/auth-patch38.css`, `marketing/src/styles.css`, `app.html`, `index.html` (login), `master.html` e páginas públicas; contagem estática nos 81 arquivos de `js/`; visita em produção a `/` e `/login` (largura ~430–530 px); contrastes calculados pela fórmula WCAG 2.
Não executado: busca `ui-ux-pro-max` e baixa das Vercel Web Interface Guidelines (passo 0 da skill), e o app autenticado (precisa de login).

---

```
UI/UX AUDIT — FinGo
===================================================

Overall Assessment: A marca (preto + verde ácido) está bem definida e aparece
com força no marketing e no login, mas o app não tem uma fonte única de verdade:
quatro arquivos CSS redefinem os mesmos tokens, ~6.800 estilos inline nos
módulos JS ignoram o sistema, e a fonte da marca nunca é carregada.
O resultado é um produto que parece FinGo na capa e "vários sistemas" por dentro.

Design System Baseline:
  - Produto: SaaS B2B (dashboard financeiro + gestão de obra), uso denso e diário
  - Estilo oficial: Brutalist Tech Industrial, escuro (fingo-brand-system)
  - Paleta oficial: #0D0D0D / #1A1A1A / #C6FF00 / #7F49B8 / #F0F0E8
  - Tipografia oficial: Monument Grotesk (display+body), JetBrains Mono (dados)
```

### Números que sustentam o diagnóstico

| Medida | Valor |
|---|---|
| Atributos `style="` nos módulos `js/` | **6.821** (master.js 778, obra_detalhe.js 626, exportar_templates.js 387, orcamento_sinapi.js 340, dashboard.js 285) |
| Cores hex literais em `js/` | **3.724** |
| Emojis usados como ícone em `js/` | **2.173** (master.js 204, lancamentos.js 92, cronograma_sla.js 93) |
| `alert/confirm/prompt` nativos | **81** (master.js 50) |
| `style.css`: hex literais / `!important` | 230 / 260 |
| `premium.css`: `!important` | 64 |
| Raios em px fora da regra de 4–6 px | 10, 14, 18, 20, 22 px |
| `gradient()` em `style.css` | 10 (marca proíbe gradiente decorativo) |
| `@font-face` de Monument Grotesk no repo | **0** |
| `icon-btn` sem `aria-label` em `js/` | 54 |

---

## PHASE 1 — Critical
(Hierarquia, usabilidade, responsividade ou consistência que prejudicam o uso)

- **Tokens / cascata (`tokens.css` ↔ `style.css` ↔ `premium.css`)**: `tokens.css` declara tudo dentro de `@layer tokens`, mas `style.css` e `premium.css` redefinem os mesmos nomes em `:root` **sem layer** — e estilo sem layer sempre vence. Na prática o "SSOT" é ignorado: `--text3` é definido 4 vezes (#e9ecf0, #94A3B8, #e9ecf0, #94A3B8 — vence o último, do `premium.css`), `--sidebar-w` vale 240 em um e 260 em outro, `--r-md` 6 px vs 4 px. `style.css` ainda faz `@import url('./tokens.css')` sem o `?v=`, baixando o arquivo duas vezes. → Um único `:root` de primitivos e semânticos em `tokens.css`, sem layer (ou todos os arquivos em layers), e os outros arquivos apenas *consomem* tokens. → Hoje mudar uma cor exige adivinhar qual das quatro definições ganha; é a raiz de quase todos os outros problemas.

- **`--fingo-mist` corrompido (`tokens.css` linha 22)**: a marca define mist = `#8E8E8E` (placeholder, rótulo inativo). O token está `#e9ecf0` — praticamente igual ao texto primário (#F0F0E8, contraste 1,03:1). `--text-muted`, `--text-tertiary` e `--color-neutral` herdam esse valor. → `--fingo-mist: #8E8E8E` (5,3:1 sobre #1A1A1A, passa AA). → Texto terciário e primário ficam indistinguíveis; a hierarquia de três níveis colapsa em um.

- **Estilos inline nos módulos JS (6.821 `style=`, 3.724 hex)**: telas inteiras (Master, Central da Obra, SINAPI, Dashboard, BIM) são montadas com cor, espaçamento e tamanho escritos à mão. Esses valores não respondem a tema claro, alto contraste nem aos modos para daltônicos que o próprio app oferece (`App.setColorblind`). → Classes de componente (`.card`, `.badge-*`, `.kpi-*`, `.stack-*`) e, quando inevitável, `style="color:var(--token)"`. Começar pelos 5 arquivos que somam 2.416 ocorrências. → Os recursos de acessibilidade anunciados ao usuário só funcionam parcialmente; é uma promessa quebrada.

- **Fonte da marca nunca carregada**: `tokens.css` e o marketing pedem "Monument Grotesk", mas não há `@font-face` nem arquivo no repo. Em produção, `document.fonts` está vazio na home: o título cai em **Impact** no Windows e na sans genérica no Mac/Android/iOS. O app carrega **Inter** do Google Fonts (`display=optional`), e `style.css`/`premium.css`/`index.html` fixam `font-family:'Inter'` direto, ignorando o token. → Licenciar Monument Grotesk (ou escolher substituta livre, ex.: Space Grotesk/Archivo para display), auto-hospedar WOFF2 em `/fonts`, `preload` dos 2 pesos da primeira tela, e todo `font-family` via `var(--font-family-base)`. → A identidade tipográfica — metade da marca — muda conforme o sistema operacional do cliente.

- **Login no celular (`/login`)**: o banner de cookies (`cookie_banner.js`, `position:fixed; z-index:999999`) cobre o campo de senha e o botão Entrar. Seu botão "Aceitar e Continuar" em verde ácido é o elemento mais forte da tela, competindo com a ação principal. → Banner compacto de uma linha no rodapé (altura ≤ 72 px), botão em estilo *ghost*, e sem bloquear o formulário; como só há cookies essenciais, avaliar trocar por aviso discreto sem botão. → A primeira ação do usuário (entrar) fica escondida atrás de um aviso secundário.

- **Verde ácido com três significados**: `--color-success`, `--brand`, `--color-primary` e o estado ativo do menu são todos `#C6FF00`. Um badge "Pago", um botão "Salvar" e o item de menu selecionado têm a mesma cor. → Manter ácido só para marca/ação/ativo; sucesso vira um verde distinto (proposta: `--color-success: #3DDC84`, ver atualizações de sistema). → Cor deixa de comunicar estado; o usuário não distingue "isto é clicável" de "isto deu certo".

- **Contraste abaixo do mínimo**:
  - Texto info/roxo (`.badge-info`, `style.css:451`, e `--color-info-text`): #7F49B8 sobre #1A1A1A = **2,94:1** (exige 4,5). → usar `--fingo-purple-light` #9B6FD4 (4,66:1) para texto, como a própria skill da marca manda.
  - Borda de input #3D3D3D sobre #1A1A1A = **1,6:1** (WCAG 1.4.11 exige 3:1 para contorno de controle). → `--border-input: #5A5A5A` (~2,6) + fundo do input `--fingo-void` para separar, ou borda #6A6A6A (≥3:1).
  - `--text-disabled` #2B2B2B sobre #1A1A1A = 1,23:1 — texto desabilitado invisível. → `#5C5C5C`.

- **Portal Master com outra marca**: `[data-theme="master"]`/`.ui-portal` troca o primário para **dourado #C5A059**, e `master.html` usa paleta Tailwind slate/emerald/sky (#94a3b8 ×21, #cbd5e1 ×19). → Master usa a mesma paleta FinGo; diferenciar o contexto com faixa/rótulo "MASTER" em roxo (`--accent-tech`), não com outra cor primária. → Quem administra vários tenants vê um produto diferente do que vende.

Review: estes itens vêm primeiro porque são causas, não sintomas. Enquanto a cascata de tokens e os estilos inline existirem, qualquer polimento de fase 2 será desfeito pela próxima tela escrita à mão.

---

## PHASE 2 — Refinement
(Espaçamento, tipografia, cor, alinhamento, iconografia)

- **Iconografia mista**: menu em SVG (`.ui-icon`) e conteúdo com 2.173 emojis (📋 💰 ⚠️…). Emojis mudam de desenho por sistema operacional, não herdam cor e contradizem "ícones angulares e geométricos" da marca. → Um único set de SVG de traço reto (ex.: Lucide/Tabler com stroke 1.75, cantos vivos) servido por `assets.js`, tamanho 16/20 px. → Coesão visual e controle de cor por token.

- **Escala tipográfica**: `tokens.css` define `--font-size-*`, mas `style.css` tem 68 `font-size` literais e **zero** usos de `var(--font-size-*)`; `premium.css` mais 32. Há tamanhos como .62, .65, .67, .68, .72, .73, .74 rem convivendo. `html{font-size:14px}` faz 0,62 rem = 8,7 px nos rótulos de seção do menu. → Consolidar em 7 degraus (11/12/13/14/16/20/28 px) e piso de 11 px para rótulo em caixa alta. → Ritmo previsível e legibilidade nos rótulos.

- **Gradientes e brilho decorativo**: logo do menu com texto em gradiente (`style.css:169`), botões e barras de progresso com gradiente, faixa marrom/âmbar em gradiente (`style.css:923`, `:948`). A marca proíbe gradiente decorativo. → Cor sólida; progresso usa cor sólida do estado. → Coerência com o brandbook e menos ruído.

- **Raios fora da regra**: 10, 14, 18, 20, 22 px em `style.css`/`premium.css`/`auth-patch38.css` (máximo da marca: 4–6 px em contêineres). → Mapear para `--radius-default` 4 / `--radius-md` 6; manter `--radius-full` só para avatar e pílula de status. → O "brutalist" depende de cantos vivos consistentes.

- **Dois sistemas de movimento**: `tokens.css` usa a curva *sharp* da marca (150 ms, `cubic-bezier(.4,0,.6,1)`); `style.css` sobrescreve `--t` com *spring* `cubic-bezier(.32,.72,0,1)`; ainda há 20 `ease`/`linear` e 14 `transition: all`. → Uma única curva (a da marca) e transições por propriedade (`color, background-color, border-color, transform`). → Movimento decidido em vez de acidental; `transition: all` também anima layout sem querer.

- **Nomes semânticos enganosos**: `--color-gold` vale roxo no app e dourado no Master; `--slate-*`, `--emerald-*`, `--indigo-*` em `style.css` são paletas Tailwind sem uso de marca. → Renomear `--color-gold*` → `--accent-tech*`; remover primitivos Tailwind não usados (3–5 usos cada). → Quem edita o CSS entende o papel da cor pelo nome.

- **Painel executivo (`dashboard.js`, 6 KPIs)**: dentro da faixa recomendada (4–6), mas a grade passa para 6 colunas acima de 1700 px e os KPIs não mostram meta nem comparação de período de forma padronizada (`kpi-change` em cinza neutro). → Cada KPI: valor, variação vs. período anterior com seta e cor de estado, e meta quando houver; manter 3 colunas até 1440 px e 6 só acima disso. → Indicador sem contexto não leva a decisão (kpi-dashboard-design).

- **Tema claro como remendo**: o tema claro existe (~500 linhas `[data-theme="light"]` com `!important`) e redefine `--fingo-offwhite` como **#101814** (quase preto) — um token chamado "offwhite" passa a ser escuro. Além disso a marca diz "nunca fundo branco", e `docs/history/VISUAL_REDESIGN.md` descreve um redesign claro verde/ardósia que não é mais o padrão. → Decidir: (a) remover o tema claro, ou (b) mantê-lo apenas por acessibilidade, construído por tokens semânticos (`--bg-*`, `--text-*`) e não por sobrescrita de primitivos. Marcar `VISUAL_REDESIGN.md` como histórico superado. → Hoje há duas direções visuais oficiais e nenhuma é completa.

Review: só faz sentido depois da fase 1 — escala, ícones e cores precisam de tokens confiáveis para não virarem mais uma camada.

---

## PHASE 3 — Polish
(Micro-interações, estados vazios/carregando/erro, detalhes)

- **Diálogos nativos (81 `alert/confirm/prompt`)**, 50 deles no `master.js`: aparecem com o visual do navegador, sem marca e sem foco gerenciado. → Usar o modal do `ui.js` (já com Tab/Escape/retorno de foco); `confirm` destrutivo com botão `btn-danger` e texto do resultado ("Excluir 3 lançamentos"). → Consistência e menos erro em ações destrutivas.

- **Botões de ícone sem nome acessível**: 54 `icon-btn` sem `aria-label`; só 25 `aria-label` em todo `js/`. → `aria-label` em todo botão só-ícone (o barramento `data-fb-click` não muda). → Leitores de tela anunciam "botão" sem dizer o quê.

- **Alvos pequenos no marketing**: links "Abrir manual ilustrado" com 16 px de altura, abas de módulo com 28–34 px. → mínimo 44 × 44 px de área clicável (padding, não fonte maior). → Uso no polegar.

- **Botão flutuante do FinBot** (home, celular) com o mesmo peso visual do CTA principal "Conheça os planos". → FinBot como ícone circular 48 px em `--bg-elevated` com borda ácida, sem texto. → Uma ação primária por tela.

- **Startup (`app.html`)**: marca montada com `style` inline e fallback `#C6FF00` fixo; o esqueleto não corresponde ao layout real (3 cartões vs. grade de 6 KPIs). → Mover para `startup.css` com tokens; esqueleto com a mesma grade do dashboard. → Transição de carregado para pronto sem salto.

- **Estados vazio/carregando**: há 31 usos de `empty-state`, 34 de skeleton e 48 de spinner/"Carregando" — três padrões. → Skeleton para listas e tabelas, spinner só em botão durante envio, `empty-state` sempre com ação ("Cadastrar primeira obra"). → O app parece vivo e ensina o próximo passo.

- **`backdrop-filter: blur` no header fixo e overlays** (`style.css:276`, `premium.css` ×4, mega menu do marketing `backdrop-blur-xl`): custo de GPU ao rolar tabelas longas. → Fundo sólido `rgba(10,10,10,.96)` no header; blur só em overlay de modal. → Rolagem mais fluida em notebooks fracos.

Review: individualmente pequenos, mas são o que separa "funciona" de "acabado". Impacto cumulativo maior em Master e Central da Obra, onde se concentram.

---

## Conflito entre os próprios guias (.md)

Os documentos do projeto não concordam entre si, o que explica parte da deriva:

| Tema | fingo-brand-system | ui-ux-audit / high-end-visual-design | frontend-design | VISUAL_REDESIGN.md |
|---|---|---|---|---|
| Fundo | sempre escuro | — | — | claro, verde sóbrio |
| Movimento | sharp, 80–300 ms | spring, 700 ms+ | sparse | — |
| Espaço | denso/industrial | `py-24`, double-bezel, eyebrow pills | — | — |
| Fonte | Monument Grotesk | evitar Inter | evitar Inter | — |

Proposta de precedência (registrar em `AGENTS.md` ou no topo de `ui-ux-audit`): **1. fingo-brand-system** (direção) → **2. design-system** (mecânica: tokens, carregamento, contraste) → **3. kpi-dashboard-design** (telas de indicadores) → demais skills só como inspiração. `VISUAL_REDESIGN.md` vira histórico. Os padrões "premium" de `high-end-visual-design` (spring 700 ms, macro-espaço, pills) não se aplicam ao app operacional; no máximo ao marketing.

---

## DESIGN_SYSTEM UPDATES REQUIRED

Aprovar antes de implementar:

- **Corrigir** `--fingo-mist: #e9ecf0 → #8E8E8E`.
- **Novo** `--color-success: #3DDC84` (separado do brand), `--color-success-dim: rgba(61,220,132,.12)`, `--color-success-border: rgba(61,220,132,.3)`.
- **Novo** `--text-info: var(--fingo-purple-light)` para texto roxo; `--fingo-purple` só para fundo/borda.
- **Alterar** `--border-input: #3D3D3D → #6A6A6A` (≥3:1 sobre #1A1A1A — verificar com a fórmula antes de aprovar).
- **Alterar** `--text-disabled: #2B2B2B → #5C5C5C`.
- **Renomear** `--color-gold*` → `--accent-tech*` (manter alias por 1 versão).
- **Remover** `--slate-*`, `--emerald-*`, `--amber-*`, `--rose-*`, `--indigo-*` de `style.css` após trocar os poucos usos.
- **Escala tipográfica** fechada: `--fs-2xs 11px, --fs-xs 12px, --fs-sm 13px, --fs-base 14px, --fs-md 16px, --fs-lg 20px, --fs-xl 28px`.
- **Movimento**: única curva `--ease-sharp`; `--t` = `150ms var(--ease-sharp)`.
- **Fonte**: `@font-face` auto-hospedado (WOFF2) para a display e a body escolhidas; `--font-family-display` novo.
- **Master**: remover o bloco dourado de `.ui-portal, [data-theme="master"]`.

---

## IMPLEMENTATION NOTES FOR BUILD AGENT

Lembrar: `js/` ↔ `frontend/` e `css/` ↔ `frontend/css/` são cópias idênticas (editar os dois); arquivos em CRLF; rodar `npm test`; sem deploy.

1. `css/tokens.css:22` — `--fingo-mist: #e9ecf0;` → `--fingo-mist: #8E8E8E;`
2. `css/tokens.css:10` — remover o `@layer tokens { … }` em volta do `:root` (ou envolver `style.css` e `premium.css` em `@layer base, components`). Critério: `getComputedStyle(document.documentElement).getPropertyValue('--text3')` deve vir de `tokens.css`.
3. `css/style.css:1` — remover `@import url('./tokens.css');` (já carregado no HTML).
4. `css/style.css:7–125` (`:root`) — apagar redefinições que existem em `tokens.css` (`--bg-*`, `--border-*`, `--accent*`, `--text*`, `--r-*`, `--space-*`, `--t*`); deixar só tokens que não existem lá (`--action-*`, `--on-*`, `--*-solid`, `--focus-ring`), movendo-os para `tokens.css`.
5. `css/style.css:61–62` — remover as duas linhas `--text3` duplicadas; `css/premium.css:3` — remover `:root { --text3: #94A3B8; }`.
6. `css/style.css:131` e `css/premium.css:9` — `font-family:'Inter',…` → `font-family:var(--font-family-base)`.
7. `css/style.css:169` — `.logo-txt h2`: remover `background:linear-gradient(...)`, `-webkit-background-clip`, `-webkit-text-fill-color`; usar `color:var(--brand)`.
8. `css/style.css:451` — `.badge-info { color:var(--info) }` → `color:var(--text-info)` (#9B6FD4, 4,66:1).
9. `css/tokens.css:44` — `--color-success: var(--fingo-acid)` → `#3DDC84`; ajustar `--color-success-dim/border/text`; `css/style.css:37–38` `--success`/`--success-bg` idem.
10. `css/tokens.css:126–142` — `.ui-portal, [data-theme="master"]`: apagar o bloco dourado inteiro.
11. `css/style.css:113–119` — `--t`, `--t-fast`, `--t-base`, `--t-slow`, `--t-enter`, `--t-spring` → usar `var(--ease-sharp)` e as durações 80/150/200/300 ms do `tokens.css`.
12. `css/style.css` — 14 `transition: all` → listar propriedades (`color, background-color, border-color, box-shadow, transform`).
13. Raios: `border-radius: 18px|20px|22px|14px|10px` → `var(--radius-md)` (6 px), exceto avatares/pílulas (`--radius-full`).
14. `js/cookie_banner.js:49–59` — reduzir a uma barra de rodapé, `z-index: var(--z-toast)`, botão secundário em `.btn-ghost`; garantir que o botão Entrar fique visível em 375 × 667.
15. `app.html:28–30` — mover estilos inline do `.startup-brand` para `css/startup.css` usando `var(--brand)` sem fallback hex.
16. Estilos inline em JS — fazer por arquivo, na ordem: `dashboard.js` (285), `orcamentos.js` (239), `obra_detalhe.js` (626), `orcamento_sinapi.js` (340), `master.js` (778). Para cada `style="color:#xxxxxx"` trocar por classe utilitária existente (`.text-success`, `.text-danger`, `.text-muted`…) ou `var(--token)`. Adicionar teste estático que conte `style="` e hex em `js/` e falhe se o número subir.
17. Diálogos — substituir `alert/confirm/prompt` nativos pelos modais de `ui.js`, começando por `master.js` (50).
18. Ícones — criar `Assets.icon(nome)` em `assets.js` com o set SVG escolhido e trocar emojis módulo a módulo.

Nada disto altera regra de negócio, API ou dados. Itens 16–18 são grandes; recomendo um PR por módulo.

---

Próximo passo: aprovar/cortar itens da fase 1. Sugestão de primeiro PR (baixo risco, alto efeito): itens 1, 3, 5, 6, 8 e 14.
