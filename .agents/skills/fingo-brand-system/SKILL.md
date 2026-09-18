---
name: fingo-brand-system
description: >
  Sistema de design da nova identidade visual FinGo — Obras em Fluxo.
  Paleta neon-industrial com verde acido #C6FF00, roxo #7F49B8 e neutros escuros
  sobre base quasi-preta. Estetica Brutalist Tech. Tipografia Monument Grotesk.
  Use quando implementar qualquer componente visual, pagina, landing, token CSS
  ou refatoracao de estilo no produto FinGo.
---

# FinGo Brand System — Skill de Design Oficial

> **Era FinGo. Obras em Fluxo.**

## PALETA PRINCIPAL (do brandbook oficial)

### Brand Color — Verde Acido Neon
- HEX: #C6FF00
- Uso: CTAs primarios, icones ativos, marca, barras de acento
- Contraste sobre fundo escuro: 12.4:1 (WCAG AAA) OK

### Paleta Oficial (extraida do brandbook)
| Token          | HEX       | Uso                                        |
|----------------|-----------|--------------------------------------------|
| --acid-green   | #C6FF00   | CTA, destaque, marca, icone ativo          |
| --void         | #0A0A0A   | Fundo hero, sidebar, body base             |
| --ink          | #0D0D0D   | Fundo padrao de paginas                    |
| --deep         | #1A1A1A   | Cards, modais, paineis                     |
| --shadow       | #282828   | Bordas, divisores                          |
| --stone        | #2B2B2B   | Hover states escuros                       |
| --smoke        | #3D3D3D   | Bordas inputs, outlines                    |
| --mist         | #8E8E8E   | Placeholders, labels inativos              |
| --silver       | #E8E8DC   | Texto secundario                           |
| --offwhite     | #F0F0E8   | Texto primario (nunca branco puro)         |
| --purple       | #7F49B8   | Acento tecnologico, badges premium         |
| --purple-light | #9B6FD4   | Hover do roxo                              |

### Cores de Sistema
- Success: #C6FF00 (aproveita o brand color)
- Warning: #FFB800 (ambar)
- Error:   #FF3B3B (vermelho industrial)
- Info:    #7F49B8 (roxo acento)

## TIPOGRAFIA

### Hierarquia
- Display: Monument Grotesk → Bebas Neue → Impact → sans-serif
  - UPPERCASE, weight 900, tracking -0.02em
- Body: Monument Grotesk → Inter → DM Sans → Helvetica Neue → sans-serif
  - Sentence case, weight 400-500, line-height 1.6
- Mono: JetBrains Mono → Fira Code → monospace
  - tabular-nums, para valores financeiros e dados

## COMPONENTES

### Botao Primario (CTA)
background: #C6FF00; color: #0A0A0A; font-weight: 700;
text-transform: uppercase; letter-spacing: 0.05em;
border-radius: 4px; padding: 12px 24px;
Hover: background #D4FF33; transform translateY(-2px);
       box-shadow 0 4px 20px rgba(198,255,0,0.3);

### Botao Secundario (Outline)
background: transparent; color: #C6FF00;
border: 2px solid #C6FF00; border-radius: 4px;
Hover: background rgba(198,255,0,0.08);

### Botao Ghost
background: transparent; color: #E8E8DC;
border: 1px solid #3D3D3D; border-radius: 4px;
Hover: border-color #C6FF00; color #C6FF00;

### Card Padrao
background: #1A1A1A; border: 1px solid #282828;
border-radius: 4px; padding: 24px;
Hover: border-color rgba(198,255,0,0.4);

### Input
background: #1A1A1A; border: 1px solid #3D3D3D;
border-radius: 4px; color: #F0F0E8; padding: 10px 14px;
Placeholder: color #8E8E8E;
Focus: border-color #C6FF00;
       box-shadow 0 0 0 2px rgba(198,255,0,0.15);

### Badge Success/Active
background: rgba(198,255,0,0.1); color: #C6FF00;
border: 1px solid rgba(198,255,0,0.25);

### Badge Premium/Info
background: rgba(127,73,184,0.1); color: #9B6FD4;
border: 1px solid rgba(127,73,184,0.25);

### Sidebar
Container: background #0D0D0D; border-right 1px solid #282828;
Ativo: background rgba(198,255,0,0.06);
       border-left 3px solid #C6FF00; color #C6FF00;
Hover: background rgba(255,255,255,0.03); color #E8E8DC;
Inativo: color #8E8E8E;

## MOTION

- Easing padrao: cubic-bezier(0.4, 0, 0.6, 1) — Sharp, decisivo
- Easing enter:  cubic-bezier(0, 0, 0.2, 1)
- Instant: 80ms | Fast: 150ms | Base: 200ms | Slow: 300ms | Reveal: 500ms

Regras:
1. Hover botoes: translateY(-2px) + sombra neon
2. Cards hover: borda neon glow sutil
3. Fade-up: translateY(8px->0) + opacity(0->1)
4. Transicoes rapidas — FinGo e eficiente, nao lenta

## ESTETICA — O QUE FINGO E

- Brutalist Tech Industrial: geometria afiada, contraste extremo
- Fundo quasi-preto com detalhes neon verde e roxo
- Tipografia comprimida em UPPERCASE para titulos
- Barras de acento verde acido como separadores
- Border-radius MAXIMO 4-6px em containers
- Icones angulares: setas diagonais, crosshairs, barras //)
- Fotos em P&B com overlay neon

## ESTETICA — O QUE FINGO NAO E

- Gradientes suaves ou rainbow
- Border-radius > 8px em elementos principais
- Fundo branco puro (#FFFFFF)
- Animacoes bounce ou elasticas
- Cores pastel ou dessaturadas
- Fontes serifadas

## CHECKLIST DE IMPLEMENTACAO

Ao criar qualquer componente/pagina FinGo:
- [ ] Fundo: #0D0D0D ou #0A0A0A (nunca branco)
- [ ] Texto primario: #F0F0E8
- [ ] CTAs: background #C6FF00, color #0A0A0A
- [ ] Cards: background #1A1A1A, border #282828
- [ ] Border-radius maximo em containers: 4-6px
- [ ] Titulos: UPPERCASE, weight 700+
- [ ] Inputs focus: box-shadow rgba(198,255,0,0.15)
- [ ] Transitions: 150ms cubic-bezier(0.4,0,0.6,1)
- [ ] Sem gradientes decorativos
- [ ] Icones angulares e geometricos

## REFERENCIAS

- Brandbook completo: brand/fingo/brandbook.jpg
- Logo principal: brand/fingo/logo-black.jpg
- Tokens JSON: brand/fingo/tokens.json
