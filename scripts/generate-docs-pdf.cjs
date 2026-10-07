const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const artifactDir = 'C:\\Users\\brenn\\.gemini\\antigravity-ide\\brain\\9e928e16-e211-4966-8eb2-4c68f029cf8f';

const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>FinGo — Documentação Técnica Completa de Sistema, Arquitetura e Código</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500;600&display=swap');

  @page {
    size: A4;
    margin: 18mm 16mm 18mm 16mm;
    @bottom-right {
      content: counter(page);
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      color: #718096;
    }
    @bottom-left {
      content: "FinGo — Documentação Técnica Oficial v2.40.6";
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      color: #718096;
    }
  }

  * { box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1a202c;
    background: #ffffff;
    line-height: 1.55;
    font-size: 9.5pt;
    margin: 0;
    padding: 0;
  }

  /* Cover Page */
  .cover-page {
    page-break-after: always;
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: #080B10;
    color: #ffffff;
    padding: 60px 45px;
    border-radius: 4px;
    position: relative;
    overflow: hidden;
  }

  .cover-page::before {
    content: "";
    position: absolute;
    top: -100px;
    right: -100px;
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(198, 255, 0, 0.15) 0%, rgba(127, 73, 184, 0.15) 50%, transparent 70%);
    border-radius: 50%;
  }

  .brand-tag {
    display: inline-block;
    background: #C6FF00;
    color: #080B10;
    font-weight: 800;
    font-size: 8pt;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 3px;
    margin-bottom: 20px;
  }

  .cover-title {
    font-size: 32pt;
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.5px;
    margin: 0 0 15px 0;
    color: #ffffff;
  }

  .cover-title span {
    color: #C6FF00;
  }

  .cover-subtitle {
    font-size: 13pt;
    font-weight: 400;
    color: #A0AEC0;
    line-height: 1.5;
    max-width: 650px;
    margin-bottom: 40px;
  }

  .cover-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    border-top: 1px solid #1E2638;
    padding-top: 25px;
    max-width: 580px;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
  }

  .meta-label {
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #718096;
    margin-bottom: 3px;
  }

  .meta-value {
    font-size: 10pt;
    font-weight: 600;
    color: #E2E8F0;
  }

  .cover-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-top: 1px solid #1E2638;
    padding-top: 20px;
    font-size: 8pt;
    color: #718096;
  }

  /* Headings & Hierarchy */
  h1 {
    font-size: 18pt;
    font-weight: 800;
    color: #0F172A;
    border-bottom: 2px solid #C6FF00;
    padding-bottom: 6px;
    margin-top: 30px;
    margin-bottom: 14px;
    page-break-after: avoid;
    letter-spacing: -0.3px;
  }

  h2 {
    font-size: 13pt;
    font-weight: 700;
    color: #1E293B;
    margin-top: 22px;
    margin-bottom: 10px;
    border-left: 3px solid #7F49B8;
    padding-left: 8px;
    page-break-after: avoid;
  }

  h3 {
    font-size: 10.5pt;
    font-weight: 600;
    color: #334155;
    margin-top: 16px;
    margin-bottom: 8px;
    page-break-after: avoid;
  }

  p {
    margin: 0 0 10px 0;
    color: #334155;
    text-align: justify;
  }

  ul, ol {
    margin: 0 0 12px 0;
    padding-left: 20px;
    color: #334155;
  }

  li {
    margin-bottom: 4px;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 18px 0;
    font-size: 8.5pt;
    page-break-inside: avoid;
  }

  th {
    background: #0F172A;
    color: #ffffff;
    font-weight: 600;
    text-align: left;
    padding: 7px 10px;
    border: 1px solid #0F172A;
  }

  td {
    padding: 6px 10px;
    border: 1px solid #CBD5E1;
    color: #1E293B;
    vertical-align: top;
  }

  tr:nth-child(even) td {
    background: #F8FAFC;
  }

  /* Code & Pre */
  code {
    font-family: 'Fira Code', monospace;
    font-size: 8pt;
    background: #F1F5F9;
    color: #0F172A;
    padding: 2px 4px;
    border-radius: 3px;
    border: 1px solid #E2E8F0;
  }

  pre {
    background: #0B0F17;
    color: #E2E8F0;
    font-family: 'Fira Code', monospace;
    font-size: 7.5pt;
    line-height: 1.45;
    padding: 12px 14px;
    border-radius: 4px;
    border: 1px solid #1E293B;
    overflow-x: hidden;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 10px 0 14px 0;
    page-break-inside: avoid;
  }

  .badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 7pt;
    font-weight: 700;
    text-transform: uppercase;
  }
  .badge-success { background: #DCFCE7; color: #15803D; }
  .badge-warning { background: #FEF3C7; color: #B45309; }
  .badge-info { background: #E0E7FF; color: #3730A3; }
  .badge-danger { background: #FEE2E2; color: #B91C1C; }

  .callout {
    background: #F8FAFC;
    border-left: 4px solid #C6FF00;
    padding: 10px 14px;
    margin: 12px 0;
    border-radius: 0 4px 4px 0;
    font-size: 9pt;
  }

  .callout-title {
    font-weight: 700;
    color: #0F172A;
    margin-bottom: 4px;
  }

  .section-break {
    page-break-before: always;
  }

  .diagram-box {
    background: #080B10;
    color: #A0AEC0;
    padding: 14px;
    border-radius: 6px;
    border: 1px solid #1E293B;
    font-family: 'Fira Code', monospace;
    font-size: 7pt;
    line-height: 1.35;
    margin: 12px 0;
    page-break-inside: avoid;
  }
  .diagram-box strong { color: #C6FF00; }
  .diagram-box em { color: #818CF8; font-style: normal; }
</style>
</head>
<body>

<!-- CAPA -->
<div class="cover-page">
  <div>
    <div class="brand-tag">Documentação Técnica Oficial</div>
    <h1 class="cover-title">FinGo <span>SaaS</span><br>Arquitetura, Código & Engenharia</h1>
    <div class="cover-subtitle">
      Guia técnico aprofundado cobrindo o Monólito Modular, Borda Cloudflare, APIs Serverless, Banco Serverless Neon PostgreSQL, Pipeline BIM 3D, Segurança e Mapeamento de Domínios.
    </div>

    <div class="cover-meta-grid">
      <div class="meta-item">
        <span class="meta-label">Versão do Sistema</span>
        <span class="meta-value">2.40.6 (Patch 56 Security)</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Classificação</span>
        <span class="meta-value">Engenharia de Software / SaaS B2B</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Domínio Principal</span>
        <span class="meta-value">fingo.api.br</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Data de Emissão</span>
        <span class="meta-value">Outubro / 2026</span>
      </div>
    </div>
  </div>

  <div class="cover-footer">
    <div><strong>FinGo Construtech Solutions</strong> • Infraestrutura de Alta Performance</div>
    <div>Página 1 de 12</div>
  </div>
</div>

<!-- CAPÍTULO 1 -->
<h1>1. Visão Geral da Plataforma e Filosofia de Engenharia</h1>
<p>
  O <strong>FinGo</strong> (anteriormente FinObra) é uma plataforma SaaS B2B de ponta desenvolvida especificamente para o ecossistema da construção civil brasileira: construtoras, incorporadoras, empreiteiras, engenheiros civis e arquitetos.
</p>
<p>
  O sistema foi projetado para unificar sob uma única experiência de usuário controles que tradicionalmente operavam fragmentados em dezenas de planilhas e softwares legados: fluxo de caixa multitenant, orçamentação analítica conectada à base oficial da Caixa Econômica Federal (<strong>SINAPI</strong>), medições de contratos com retenções tributárias na fonte (ISS, INSS, IRRF), monitoramento automático de notas fiscais SEFAZ via Certificado A1, automação de canteiro de obras via WhatsApp e visualizador 3D BIM com clash detection em tempo real.
</p>

<h2>1.1 Princípios de Design de Software</h2>
<ul>
  <li><strong>Monólito Modular com Fronteiras Rígidas:</strong> Separação estrita em Bounded Contexts (Fiscal, Financeiro, Obras, Suprimentos, Contratos, Atendimento, Gestão e Configurações). Elimina o custo de orquestração de microsserviços sem gerar acoplamento espaguete.</li>
  <li><strong>Processamento de Borda (Edge-First):</strong> A maior parte das validações, segurança ativa (WAF, Fail2Ban, Anti-Abuso), roteamento e entrega de assets estáticos ocorre na rede global do <strong>Cloudflare Workers & Pages</strong> com latência sub-20ms.</li>
  <li><strong>Offline-First no Canteiro:</strong> Arquitetura de persistência local baseada em IndexedDB nativo do navegador, com barramento de sincronização idempotente com circuit-breaker e detecção de conflitos de versão.</li>
  <li><strong>Zero Framework Lock-in no Core:</strong> O frontend principal foi desenvolvido em JavaScript Moderno ES6+ puro (Vanilla Modular), garantindo carregamento instantâneo (Time-to-Interactive &lt; 800ms) mesmo em dispositivos móveis conectados em redes 3G/4G no canteiro.</li>
</ul>

<h2>1.2 Topologia Completa da Infraestrutura</h2>
<div class="diagram-box">
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   TOPOLOGIA DE NUVEM FINGO                                      │
│                                                                                                 │
│  [ CLIENTES / DISPOSITIVOS ]                                                                    │
│     ├── Desktop / Notebook (Chrome, Edge, Firefox, Safari)                                      │
│     ├── Tablets & Celulares de Canteiro (PWA com IndexedDB Local Cache)                         │
│     └── Terceiros & Fornecedores (Portais Públicos de Medição, Assinatura e BDI)                │
│                                           │                                                     │
│                                           ▼ HTTPS / WSS / TLS 1.3                               │
│  [ BORDA GLOBAL CLOUDFLARE (Edge Worker & Pages) ] ── fingo.api.br                              │
│     ├── Reverse Proxy & SPA Fallback (/app, /bim, /master, /portal)                             │
│     ├── CDN Global de Distribuição Sanitizada (pasta dist/ gerada por vite)                     │
│     ├── WAF & Fail2Ban Distribuído no Cloudflare KV (Ban de Scanners e IPs de Força Bruta)      │
│     ├── Reputação de Segurança & Bloqueio Imediato de Scanners (.env, .aws, .git)               │
│     ├── Storage de Arquivos & Documentos de Obra no Cloudflare R2 (fingo-attachments)           │
│     └── Conector MCP (Model Context Protocol) & AI Agent Cards (RFC 9727 / RFC 9116)            │
│                                           │                                                     │
│                    ┌──────────────────────┴──────────────────────┐                              │
│                    ▼                                             ▼                              │
│  [ MICRO-APIS SERVERLESS (api/*) ]          [ CONTAINER 24/7 RENDER (backend/server.js) ]       │
│     • Multiplexação em 12 rotas públicas       • Conexão contínua WhatsApp Baileys              │
│     • Autenticação JWT / TOTP RFC 6238         • Robô SINAPI 27 UFs (Caixa/IBGE)                │
│     • CRUD financeiro, medições e obras        • Cron jobs periódicos e DF-e SEFAZ              │
│     • Conexão pooling direta Neon              • Docker alpine leve com healthcheck             │
│                    │                                             │                              │
│                    └──────────────────────┬──────────────────────┘                              │
│                                           │ SSL Connection Pool (Postgres Direct Wire)          │
│                                           ▼                                                     │
│  [ BANCO DE DADOS NEON POSTGRESQL (Lakebase Serverless) ]                                       │
│     ├── Multi-Tenancy obrigatório com FORCE ROW LEVEL SECURITY (RLS)                            │
│     ├── Role finobra_app (NOBYPASSRLS) para operações de runtime isoladas                       │
│     ├── Role neondb_owner restrita exclusivamente para migrações DDL                            │
│     └── Versionamento atômico em migrations/ (001 a 036+)                                       │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
</div>

<!-- CAPÍTULO 2 -->
<div class="section-break"></div>
<h1>2. Mapeamento de Domínios e Estrutura do Código</h1>
<p>
  A arquitetura do FinGo organiza o código em 8 domínios funcionais espelhados de ponta a ponta entre Frontend e Backend, permitindo que alterações de regras de negócio fiquem estritamente isoladas em seus respectivos submódulos.
</p>

<h2>2.1 Árvore de Diretórios do Repositório</h2>
<pre>
d:/Projects/FINANÇAS/
├── api/                           # Handlers Serverless Node.js (Vercel & Edge Adapter)
│   ├── _auth.js                   # Módulo criptográfico de senhas (scrypt) e tokens JWT
│   ├── _database.js               # Gerenciador de conexão pooling com Neon Postgres
│   ├── _edge-security.js          # WAF de borda, Fail2Ban, reputação de IPs e scanners
│   ├── _edge-ledger.js            # Trilha de auditoria criptográfica SHA-256
│   ├── _sefaz-dfe.js              # Integração mTLS com SEFAZ via Certificado A1
│   ├── _workflow.js               # Motor de cálculo e cascata de etapas e SLAs
│   ├── auth.js                    # Endpoint público /api/auth
│   ├── db.js                      # Endpoint público /api/db (Delta Sync e Mutações)
│   ├── dashboard.js               # Endpoint público /api/dashboard (KPIs)
│   └── whatsapp.js                # Endpoint público /api/whatsapp
├── backend/                       # Servidor Contínuo 24/7 (Container Render)
│   ├── server.js                  # Ponto de entrada Express, Baileys e Cron
│   ├── sinapi_robot.js            # Robô autônomo de download e parsing da base SINAPI
│   └── domains/                   # Espelho modular backend por Bounded Contexts
├── frontend/                      # Código-Fonte do Cliente Web SPA
│   ├── core/                      # auth.js, data.js (IndexedDB), ui.js, events.js
│   ├── domains/                   # Módulos de domínio (fiscal, financeiro, obras, etc.)
│   ├── app.html                   # Shell da aplicação logada
│   ├── master.html                # Shell de governança do superadministrador
│   └── bim.html                   # Shell do visualizador 3D BIM
├── cloudflare-worker.js           # Gateway Edge reverso no Cloudflare Workers
├── migrations/                    # Scripts SQL atômicos de evolução de schema (001 a 036)
├── scripts/                       # Ferramentas de CI/CD, testes rápidos e deploys
└── dist/                          # Artefatos sanitizados de produção para Cloudflare Pages
</pre>

<h2>2.2 Dicionário dos 8 Bounded Contexts</h2>
<table>
  <thead>
    <tr>
      <th style="width: 18%;">Domínio</th>
      <th style="width: 38%;">Responsabilidade Central</th>
      <th style="width: 44%;">Componentes e Tabelas Chave</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>1. Fiscal</strong></td>
      <td>Download, parser XML e manifesto de notas fiscais SEFAZ contra o CNPJ da construtora usando certificado A1.</td>
      <td><code>nfe.js</code>, <code>_sefaz-dfe.js</code>, <code>_certificado.js</code><br>Tabelas: <code>tenant_certificates</code>, <code>documentos</code></td>
    </tr>
    <tr>
      <td><strong>2. Financeiro</strong></td>
      <td>Contas a pagar/receber, extratos bancários, conciliação OFX inteligente, DRE Gerencial e checkout PIX.</td>
      <td><code>lancamentos.js</code>, <code>contas.js</code>, <code>ofx.js</code>, <code>_plans.js</code><br>Tabelas: <code>lancamentos</code>, <code>contas</code>, <code>billing_invoices</code></td>
    </tr>
    <tr>
      <td><strong>3. Obras &amp; Engenharia</strong></td>
      <td>Controle de canteiro, orçamentos SINAPI desonerados, boletins de medição com retenções e visualizador BIM.</td>
      <td><code>obra_detalhe.js</code>, <code>medicoes.js</code>, <code>bim_viewer.js</code><br>Tabelas: <code>obras</code>, <code>medicoes</code>, <code>workflow_etapas</code></td>
    </tr>
    <tr>
      <td><strong>4. Suprimentos</strong></td>
      <td>Requisição de insumos direto do canteiro (pré-compras), cotações e catálogo de fornecedores.</td>
      <td><code>precompras.js</code>, <code>produtos.js</code>, <code>fornecedores.js</code><br>Tabelas: <code>precompras</code>, <code>fornecedores</code>, <code>produtos</code></td>
    </tr>
    <tr>
      <td><strong>5. Contratos</strong></td>
      <td>Geração de instrumentos jurídicos, assinatura eletrônica com carimbo de tempo e hash SHA-256 (ICP-Brasil).</td>
      <td><code>contratos.js</code>, <code>assinador.js</code>, <code>gdrive.js</code><br>Tabelas: <code>contratos</code>, <code>assinaturas</code></td>
    </tr>
    <tr>
      <td><strong>6. Atendimento</strong></td>
      <td>Comunicação ativa por WhatsApp, avisos de cobrança, alerta de etapas e assistente FinBot.</td>
      <td><code>whatsapp.js</code>, <code>suporte.js</code>, <code>notificacoes.js</code><br>Integração: Baileys WebSocket API / Render</td>
    </tr>
    <tr>
      <td><strong>7. Gestão Executiva</strong></td>
      <td>Dashboard em tempo real de liquidez, inadimplência, central do gestor, Kanban e Gantt.</td>
      <td><code>dashboard.js</code>, <code>central_gestor.js</code>, <code>minhas_demandas.js</code><br>Cálculos analíticos em tempo real</td>
    </tr>
    <tr>
      <td><strong>8. Configurações</strong></td>
      <td>Administração de usuários, cargos, políticas de senhas, auditoria criptográfica e multi-tenancy.</td>
      <td><code>configuracoes.js</code>, <code>master.js</code>, <code>dev-tenant-keys.js</code><br>Tabelas: <code>tenants</code>, <code>usuarios</code>, <code>audit_ledger</code></td>
    </tr>
  </tbody>
</table>

<!-- CAPÍTULO 3 -->
<div class="section-break"></div>
<h1>3. Segurança Cibernética, Criptografia e Proteção de Borda</h1>
<p>
  A segurança no FinGo é estruturada segundo o princípio militar de <strong>Defesa em Profundidade (*Defense in Depth*)</strong>, com barreiras rigorosas na borda DNS, no gateway de requisições, no runtime de autenticação e no isolamento físico do banco de dados.
</p>

<h2>3.1 Camada 1: WAF de Borda, Fail2Ban e Reputação de IPs</h2>
<p>
  O arquivo <code>api/_edge-security.js</code> executa no Cloudflare Worker antes de qualquer processamento de rota:
</p>
<ul>
  <li><strong>Reputação de IPs Maliciosos (Bélgica e EUA):</strong> Bloqueio imediato com <code>403 Forbidden (EDGE_IP_BANNED)</code> de faixas e endereços de scanners agressivos conhecidos (como <code>34.38.113.44</code> da GCP Bélgica e <code>40.160.65.14</code> da Microsoft Azure).</li>
  <li><strong>Bloqueio de Probes de Vulnerabilidades:</strong> Interceptação sumária de requisições para arquivos de credenciais e configurações expostas:
    <ul>
      <li>Variantes de <code>.env</code>: <code>/.env.old</code>, <code>/.env.staging</code>, <code>/api/.env</code>, <code>/config/.env</code>.</li>
      <li>Configurações de nuvem: <code>/.aws/config</code>, <code>/.aws/credentials</code>, <code>/.docker/config.json</code>.</li>
      <li>Controle de versão e dotfiles: <code>/.git/config</code>, <code>/.vscode/settings.json</code>, <code>/.ssh/id_rsa</code>.</li>
      <li>Scripts e dumps perigosos: <code>wp-config.php</code>, <code>dump.sql</code>, <code>backup.sql</code>, <code>phpmyadmin</code>.</li>
    </ul>
  </li>
  <li><strong>Bloqueio de User-Agents Ofensivos:</strong> Detecção e corte de tráfego de bots ofensivos (<code>AgenstryBot</code>, <code>cloud-crawler</code>, <code>nikto</code>, <code>sqlmap</code>, <code>censys</code>, <code>shodan</code>).</li>
  <li><strong>Fail2Ban Distribuído no Cloudflare KV:</strong> Qualquer IP que atinja 5 falhas de autenticação ou comportamento anômalo em uma janela de 10 minutos é banido automaticamente por 30 minutos em toda a rede global de borda (HTTP 429).</li>
  <li><strong>Idempotência Criptográfica:</strong> Header <code>X-Idempotency-Key</code> em requisições mutantes (POST/PUT) previne cliques duplos e duplicidade de cobranças ou lançamentos bancários (HTTP 409).</li>
  <li><strong>Conformidade RFC 9116:</strong> Arquivo público padronizado servido na borda em <code>https://fingo.api.br/.well-known/security.txt</code>.</li>
</ul>

<h2>3.2 Camada 2: Política Rigorosa de Senhas e Hashing Assíncrono com Scrypt</h2>
<p>
  Toda a gestão de credenciais no FinGo cumpre os padrões mais rigorosos do NIST SP 800-63B e da OWASP:
</p>
<ul>
  <li><strong>Requisitos de Complexidade de Senha:</strong>
    <ul>
      <li>Mínimo de 8 caracteres e máximo de 128 caracteres.</li>
      <li>Pelo menos 1 letra maiúscula e 1 letra minúscula.</li>
      <li>Pelo menos 1 número e proibição expressa de sequências numéricas óbvias (<code>123456</code>, <code>654321</code>, <code>012345</code>).</li>
      <li>Pelo menos 1 símbolo ou caractere especial (<code>!@#$%^&amp;*()_+\-=\[\]{}|;:,.&lt;&gt;?</code>).</li>
    </ul>
  </li>
  <li><strong>Derivação de Chave Criptográfica com <code>crypto.scrypt</code>:</strong>
    A derivação é executada de forma assíncrona com alto consumo de memória e CPU (parâmetros de custo: <code>N=16384</code>, <code>r=8</code>, <code>p=1</code>, 64 bytes de saída) acoplada a um <em>Salt</em> criptograficamente aleatório de 16 bytes gerado por <code>crypto.randomBytes(16)</code>. O formato persistido é <code>scrypt:N:r:p:saltHex:hashHex</code>, tornando ataques de dicionário e tabelas rainbow computacionalmente inviáveis mesmo em caso de vazamento.
  </li>
  <li><strong>Autenticação de Dois Fatores (2FA / TOTP):</strong> Compatível com Google Authenticator e 1Password conforme a RFC 6238, com geração de códigos de contingência unívocos.</li>
</ul>

<h2>3.3 Camada 3: Content Security Policy (CSP) Estrita e Event Bridge</h2>
<p>
  Para anular vetores de Cross-Site Scripting (XSS), o FinGo opera sob a diretiva de cabeçalho <code>script-src-attr 'none'</code>. Nenhum evento inline (como <code>onclick</code> ou <code>onload</code>) é permitido nos templates HTML. Em vez disso, o barramento declarativo em <code>js/patch26-events.js</code> escuta atributos desacoplados como <code>data-fb-click="salvar_lancamento"</code>, associando-os com segurança no ciclo de vida da aplicação.
</p>

<!-- CAPÍTULO 4 -->
<div class="section-break"></div>
<h1>4. Banco de Dados: Neon PostgreSQL &amp; Multi-Tenancy</h1>
<p>
  O banco de dados do FinGo é hospedado na arquitetura serverless <strong>Neon Lakebase Postgres</strong>, beneficiando-se de auto-scaling, scale-to-zero para redução de custos, pooling de conexões transacionais e alta resiliência de dados.
</p>

<h2>4.1 Isolamento Rígido com Row Level Security (RLS)</h2>
<p>
  O multi-tenancy é assegurado a nível de banco de dados por políticas ativas de RLS, garantindo que mesmo se houver uma falha de lógica na camada de aplicação, nenhuma construtora conseguirá ler ou modificar os registros de outra:
</p>
<pre>
-- Exemplo da política ativa no banco Neon
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON lancamentos
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
</pre>

<h2>4.2 Principais Tabelas do Sistema</h2>
<table>
  <thead>
    <tr>
      <th style="width: 22%;">Tabela</th>
      <th style="width: 38%;">Colunas Principais</th>
      <th style="width: 40%;">Finalidade e Regras de Integridade</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>tenants</code></td>
      <td><code>id, razao_social, cnpj, plano, status, created_at, storage_limit_mb</code></td>
      <td>Empresas e construtoras cadastradas. Chave raiz para todas as outras entidades do sistema.</td>
    </tr>
    <tr>
      <td><code>usuarios</code></td>
      <td><code>id, tenant_id, nome, email, senha_hash, perfil, mfa_secret, ativo</code></td>
      <td>Usuários operadores. <code>senha_hash</code> gerado com scrypt assíncrono. Perfil RBAC (admin, gestor, financeiro, canteiro).</td>
    </tr>
    <tr>
      <td><code>obras</code></td>
      <td><code>id, tenant_id, nome, cliente_id, endereco, metragem_total, status, cub_uf</code></td>
      <td>Empreendimentos e construções. Vínculo para centros de custos, etapas e cronogramas.</td>
    </tr>
    <tr>
      <td><code>workflow_etapas</code></td>
      <td><code>id, obra_id, tenant_id, nome_etapa, ordem, predecessor_id, sla_dias, status</code></td>
      <td>Etapas do cronograma em cascata. Conclusão da etapa predecessora dispara sucessora.</td>
    </tr>
    <tr>
      <td><code>lancamentos</code></td>
      <td><code>id, tenant_id, obra_id, conta_id, tipo, valor, data_vencimento, data_pagamento</code></td>
      <td>Entradas e saídas financeiras, conciliações bancárias, DRE e fluxo de caixa.</td>
    </tr>
    <tr>
      <td><code>medicoes</code></td>
      <td><code>id, obra_id, tenant_id, numero, periodo_inicio, periodo_fim, valor_bruto, retencoes</code></td>
      <td>Boletins de medição com deduções de impostos na fonte (INSS/ISS/IRRF) e liberação de parcelas.</td>
    </tr>
    <tr>
      <td><code>precompras</code></td>
      <td><code>id, obra_id, tenant_id, solicitante, itens, status, valor_estimado</code></td>
      <td>Requisições originadas do canteiro. Estados: <code>solicitado</code>, <code>cotado</code>, <code>aprovado</code>, <code>comprado</code>.</td>
    </tr>
    <tr>
      <td><code>documentos</code></td>
      <td><code>id, tenant_id, obra_id, nome_arquivo, r2_key, mime_type, tamanho_bytes</code></td>
      <td>Catálogo de anexos armazenados com segurança no Cloudflare R2 com URLs assinadas.</td>
    </tr>
    <tr>
      <td><code>audit_ledger</code></td>
      <td><code>id, tenant_id, actor_id, action, target_type, block_hash, previous_hash</code></td>
      <td>Trilha de auditoria criptográfica baseada em encadeamento SHA-256 à prova de adulteração.</td>
    </tr>
  </tbody>
</table>

<!-- CAPÍTULO 5 -->
<div class="section-break"></div>
<h1>5. Engenharia, Orçamentos SINAPI e Pipeline BIM 3D</h1>

<h2>5.1 Motor de Orçamento Base Oficial SINAPI (Caixa / IBGE)</h2>
<p>
  O FinGo implementa a metodologia regulamentar federal do <strong>Decreto nº 7.983/2013</strong> e da <strong>Nova Lei de Licitações (Lei nº 14.133/2021)</strong> para estimativa de custos e composições de serviços:
</p>
<ul>
  <li><strong>24 Bases Regionais por UF:</strong> Ingestão mensal automática dos relatórios da Caixa Econômica Federal para as 27 Unidades da Federação.</li>
  <li><strong>Regimes Desonerado e Não Desonerado:</strong> Aplicação dinâmica das alíquotas de encargos sociais sobre mão de obra (com desoneração da folha de pagamento pela Lei nº 12.546/2011).</li>
  <li><strong>Cálculo Oficial de BDI Diferenciado:</strong> Aplicação da fórmula do Acórdão 2.622/2013 do Tribunal de Contas da União (TCU), diferenciando taxas de BDI para aquisição de materiais e execução de serviços.</li>
</ul>

<h2>5.2 Pipeline BIM 3D e Coordenação de Projetos</h2>
<p>
  O visualizador tridimensional em <code>bim.html</code> e <code>js/bim_viewer.js</code> opera no navegador utilizando a biblioteca <strong>Three.js</strong>:
</p>
<ul>
  <li><strong>Carregamento Otimizado de Geometrias:</strong> Suporte a formatos abertos GLB/glTF e tesselação paramétrica CSG (Constructive Solid Geometry) com orçamentos de memória rigorosos (&lt; 15 MB por modelo web).</li>
  <li><strong>Clash Detection Real:</strong> Motor em <code>js/bim_clash_engine.js</code> para detecção matemática de interferências físicas espaciais entre disciplinas (Estrutura vs. Hidráulica vs. Elétrica) calculada diretamente nas caixas de colisão delimitadoras (*Bounding Boxes* e *BVH Trees*).</li>
  <li><strong>Invariante de Engenharia:</strong> Conforme definido na governança do repositório, geometrias geradas proceduralmente ou conceituais nunca são promovidas a BIM autoritativo para medição oficial sem chancela técnica.</li>
</ul>

<!-- CAPÍTULO 6 -->
<div class="section-break"></div>
<h1>6. Especificação das APIs RESTful &amp; Protocolo MCP</h1>
<p>
  Todas as requisições para a API exigem transporte seguro sob HTTPS, cabeçalhos de conteúdo JSON e identificação de tenant.
</p>

<h2>6.1 Especificação dos Principais Endpoints</h2>
<table>
  <thead>
    <tr>
      <th style="width: 14%;">Método</th>
      <th style="width: 26%;">Endpoint</th>
      <th style="width: 32%;">Ação / Parâmetros</th>
      <th style="width: 28%;">Resposta Típica</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><span class="badge badge-success">POST</span></td>
      <td><code>/api/auth?action=login</code></td>
      <td>Validação de credenciais (email e senha scrypt).</td>
      <td><code>{ success: true, token, user }</code></td>
    </tr>
    <tr>
      <td><span class="badge badge-success">POST</span></td>
      <td><code>/api/auth?action=2fa_verify</code></td>
      <td>Validação de token TOTP de 6 dígitos.</td>
      <td><code>{ success: true, verified: true }</code></td>
    </tr>
    <tr>
      <td><span class="badge badge-info">GET</span></td>
      <td><code>/api/db?resource=obras</code></td>
      <td>Lista obras do tenant autenticado.</td>
      <td><code>{ success: true, data: [...] }</code></td>
    </tr>
    <tr>
      <td><span class="badge badge-success">POST</span></td>
      <td><code>/api/db?resource=lancamentos</code></td>
      <td>Criação de transação financeira com idempotência.</td>
      <td><code>{ success: true, id: "..." }</code></td>
    </tr>
    <tr>
      <td><span class="badge badge-info">GET</span></td>
      <td><code>/api/dashboard</code></td>
      <td>Retorna KPIs agregados (saldo, DRE, prazos).</td>
      <td><code>{ success: true, kpis: {...} }</code></td>
    </tr>
    <tr>
      <td><span class="badge badge-success">POST</span></td>
      <td><code>/api/nfe?action=sync_sefaz</code></td>
      <td>Dispara consulta DF-e SEFAZ via mTLS A1.</td>
      <td><code>{ success: true, novas_notas: 3 }</code></td>
    </tr>
    <tr>
      <td><span class="badge badge-success">POST</span></td>
      <td><code>/api/whatsapp?action=send</code></td>
      <td>Envio de mensagem de cobrança ou início de fase.</td>
      <td><code>{ success: true, messageId: "..." }</code></td>
    </tr>
    <tr>
      <td><span class="badge badge-warning">ALL</span></td>
      <td><code>/api/mcp</code> e <code>/sse</code></td>
      <td>Endpoint de streaming do Model Context Protocol.</td>
      <td>Protocolo JSON-RPC 2.0 / SSE Stream</td>
    </tr>
  </tbody>
</table>

<h2>6.2 Protocolo MCP (Model Context Protocol)</h2>
<p>
  O FinGo é uma das primeiras plataformas de construção civil nativamente preparada para a era de agentes de inteligência artificial. O endpoint <code>/api/mcp</code> permite que assistentes externos (Claude, Gemini, Copilot) inspecionem medições, consultem a base SINAPI e interajam com a plataforma com segurança através do protocolo formal MCP.
</p>

<!-- CAPÍTULO 7 -->
<div class="section-break"></div>
<h1>7. Ciclo de Vida de Deploy e Governança Operacional</h1>

<h2>7.1 Regras Inegociáveis do Repositório (AGENTS.md)</h2>
<div class="callout">
  <div class="callout-title">🚨 Política de Tolerância Zero para Segredos (Zero Secrets in Repository)</div>
  NUNCA salvar ou commitar credenciais reais, senhas de banco (<code>npg_</code>), connection strings completas ou tokens de API. Todo o carregamento é feito estritamente em runtime via variáveis de ambiente (.env.local no dev e Wrangler/Render Secrets na produção). O scanner <code>scripts/security-secrets-scanner.cjs</code> roda obrigatoriamente antes de qualquer teste.
</div>

<div class="callout">
  <div class="callout-title">🚨 Ordem Obrigatória: Testes ➔ Commit ➔ Push ➔ Deploy</div>
  Nenhum deploy para Cloudflare ou Render pode ser executado antes que a suíte completa de testes passe (<code>npm run test:fast</code>), o commit semântico seja realizado e o push para a branch remota esteja confirmado.
</div>

<h2>7.2 Comandos Operacionais Chave</h2>
<table>
  <thead>
    <tr>
      <th style="width: 35%;">Comando</th>
      <th style="width: 65%;">Descrição e Finalidade</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>npm run test:fast</code></td>
      <td>Executa o scanner de segurança e os 118 testes automatizados em paralelo (~24s).</td>
    </tr>
    <tr>
      <td><code>npm run build:cloudflare</code></td>
      <td>Gera os artefatos de distribuição sanitizados na pasta <code>dist/</code> com vite e patch 38.</td>
    </tr>
    <tr>
      <td><code>node scripts/deploy-cloudflare.js</code></td>
      <td>Publica o Worker e as Pages no Cloudflare utilizando o token seguro do <code>.env.local</code>.</td>
    </tr>
    <tr>
      <td><code>node scripts/organize-modular-files.cjs</code></td>
      <td>Sincroniza automaticamente alterações entre a raiz pública e os domínios modulares.</td>
    </tr>
    <tr>
      <td><code>npm run render:deploy</code></td>
      <td>Dispara deploy no serviço contínuo 24/7 de WhatsApp no Render.</td>
    </tr>
  </tbody>
</table>

<div style="margin-top: 50px; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 20px; color: #718096; font-size: 8.5pt;">
  <strong>FinGo Plataforma de Gestão e Engenharia</strong> • Versão 2.40.6<br>
  Documentação Técnica Gerada Automatizada • Todos os direitos reservados.
</div>

</body>
</html>`;

async function generate() {
  console.log('📄 Gerando documentação técnica completa em PDF com Chromium...');

  const tempHtmlPath = path.join(artifactDir, 'documentacao-fingo-temp.html');
  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });

  const pdfWorkspacePath = path.join(root, 'docs', 'fingo-documentacao-completa.pdf');
  const pdfArtifactPath = path.join(artifactDir, 'fingo-documentacao-completa.pdf');

  await page.pdf({
    path: pdfWorkspacePath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '12mm',
      bottom: '12mm',
      left: '12mm',
      right: '12mm'
    }
  });

  // Copia para os artefatos
  fs.copyFileSync(pdfWorkspacePath, pdfArtifactPath);

  await browser.close();

  if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);

  const stats = fs.statSync(pdfWorkspacePath);
  console.log(`✅ PDF gerado com sucesso! Tamanho: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log(`📍 Local 1 (Workspace): ${pdfWorkspacePath}`);
  console.log(`📍 Local 2 (Artifacts): ${pdfArtifactPath}`);
}

generate().catch(err => {
  console.error('❌ Falha ao gerar PDF:', err);
  process.exit(1);
});
