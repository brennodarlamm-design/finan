# FinGo — Páginas Públicas & Marketing

> **Fronteira Arquitetural:** Portal de Aquisição, Páginas Institucionais e Ferramentas Públicas  
> **Destino de Distribuição:** Cloudflare Pages (copiado para `dist/` durante `npm run build:cloudflare`)

---

## 1. Catálogo de Páginas Públicas

| Arquivo | Rota Canônica | Propósito | Tecnologias |
| :--- | :--- | :--- | :--- |
| `landing.html` | `/` ou `/landing` | Página inicial de apresentação, proposta de valor e demonstração em vídeo. | React / Vite + Tailwind CSS |
| `planos.html` | `/planos` | Tabela comparativa de planos (Básico, Pro, Enterprise) e checkout. | React / Vite + Tailwind CSS |
| `sobre-nos.html` | `/sobre-nos` | História da empresa, missão e contato institucional. | React / Vite + Tailwind CSS |
| `blog.html` | `/blog` | Artigos técnicos sobre gestão de obras, SINAPI e retenções. | HTML Semântico + SEO |
| `manuais.html` | `/manuais` | Central de documentação e manuais operacionais do usuário. | HTML Semântico + SEO |
| `calculadora-bdi.html` | `/calculadora-bdi` | Ferramenta pública interativa de cálculo de BDI (Decreto 7.983/13). | Vanilla JS + CSS Tokens |
| `validar.html` | `/validar` | Validador público de assinaturas eletrônicas com hash SHA-256. | Web Crypto API |
| `privacidade.html` | `/privacidade` | Política de Privacidade em conformidade com a LGPD. | HTML Semântico |
| `termos.html` | `/termos` | Termos e Condições Gerais de Uso do SaaS. | HTML Semântico |
