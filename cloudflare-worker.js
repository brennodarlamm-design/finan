import { executeEdgeApi } from './api/_edge-adapter.js';
import { applyEdgeSecurityMiddleware } from './api/_edge-security.js';
import { recordEdgeMetric, getEdgeMetricsSummary, renderEdgeMetricsHtml } from './api/_edge-metrics.js';
import { dispatchEdgeAlert } from './api/_edge-alerts.js';
import { createCriticalR2Backup, migrateLegacyDocumentsToR2 } from './api/_edge-backup.js';
export { BudgetSyncRoom } from './api/_edge-realtime.js';

const DEFAULT_API_ORIGIN = 'https://api.fingo.api.br';
const DEFAULT_CANONICAL_ORIGIN = 'https://fingo.api.br';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function sameOriginBrowserRequest(request) {
  const origin = String(request.headers.get('Origin') || '').trim();
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function upstreamOrigin(env) {
  const raw = String(env.FINOBRA_API_ORIGIN || DEFAULT_API_ORIGIN).trim();
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('FINOBRA_API_ORIGIN deve usar HTTPS.');
  return url.origin;
}

function canonicalOrigin(env) {
  const raw = String(env.FINOBRA_CANONICAL_ORIGIN || DEFAULT_CANONICAL_ORIGIN).trim();
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('FINOBRA_CANONICAL_ORIGIN deve usar HTTPS.');
  return url.origin;
}

async function authenticateEdgeRequest(request, env) {
  const authUrl = new URL('/api/auth?action=me', upstreamOrigin(env));
  const headers = new Headers();
  for (const name of ['cookie','authorization','x-api-key','apikey','x-tenant-id','user-agent']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('Accept', 'application/json');
  try {
    const response = await fetch(authUrl.toString(), {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(8000)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.success || !body?.user?.id || !body?.user?.tenantId) {
      return { ok:false, status:response.status === 403 ? 403 : 401 };
    }
    return {
      ok:true,
      userId:String(body.user.id),
      userName:String(body.user.nome || body.user.username || 'Usuário'),
      role:String(body.user.perfil || 'visualizador').toLowerCase(),
      tenantId:String(body.user.tenantId)
    };
  } catch (error) {
    console.warn('[FinGo Realtime] Falha ao validar sessão:', error?.message || error);
    return { ok:false, status:503 };
  }
}

function isApiPath(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/');
}

function isAppShellPath(pathname) {
  return pathname === '/app' || pathname === '/app.html' || pathname.startsWith('/app/') || pathname === '/portal' || pathname.startsWith('/portal/');
}

function isBimShellPath(pathname) {
  return pathname === '/bim' || pathname === '/bim.html';
}

function isLoginShellPath(pathname) {
  return pathname === '/login' || pathname === '/login.html' || pathname === '/cadastro';
}

function isMasterShellPath(pathname) {
  return pathname === '/master' || pathname === '/master.html';
}

function canonicalRedirect(request, env) {
  const method = String(request.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD'].includes(method)) return null;

  try {
    const incoming = new URL(request.url);
    const canonical = new URL(canonicalOrigin(env));
    const wwwHost = `www.${canonical.hostname}`;
    if (isApiPath(incoming.pathname)) return null;

    const forceCanonicalHost = incoming.hostname === wwwHost;
    const target = new URL(incoming.pathname + incoming.search, forceCanonicalHost ? canonical : incoming.origin);
    let changed = forceCanonicalHost;

    if (['/landing', '/landing.html', '/index.html'].includes(target.pathname)) {
      target.pathname = '/';
      changed = true;
    }

    if (target.pathname === '/app.html') {
      target.pathname = '/app';
      changed = true;
    } else if (target.pathname === '/bim.html') {
      target.pathname = '/bim';
      changed = true;
    } else if (target.pathname === '/login.html') {
      target.pathname = '/login';
      changed = true;
    } else if (target.pathname === '/master.html') {
      target.pathname = '/master';
      changed = true;
    }

    const cadastro = target.searchParams.get('cadastro') === '1';
    const expired = target.searchParams.get('expired') === '1';
    if ((target.pathname === '/' || target.pathname === '/login') && cadastro) {
      target.pathname = '/cadastro';
      target.searchParams.delete('cadastro');
      changed = true;
    } else if (target.pathname === '/' && expired) {
      target.pathname = '/login';
      changed = true;
    }

    if (!changed) return null;
    return new Response(null, {
      status: 308,
      headers: {
        Location: target.toString(),
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (err) {
    console.warn('[FinObra Cloudflare] não foi possível aplicar redirect canônico:', err?.message || err);
    return null;
  }
}

function buildContentSecurityPolicy(nonce) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' https://accounts.google.com https://apis.google.com https://cdn.sheetjs.com https://cdnjs.cloudflare.com https://static.cloudflareinsights.com`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://accounts.google.com https://apis.google.com https://www.googleapis.com https://content.googleapis.com https://generativelanguage.googleapis.com https://brasilapi.com.br https://viacep.com.br https://api.meudanfe.com.br https://finan-wf12.onrender.com https://*.blob.vercel-storage.com https://cloudflareinsights.com https://raw.githubusercontent.com https://github.com",
    "frame-src 'self' blob: data: https://accounts.google.com https://drive.google.com https://docs.google.com",
    "worker-src 'self' blob: https://cdnjs.cloudflare.com",
    "manifest-src 'self'",
    "media-src 'self' blob: https:",
    'upgrade-insecure-requests'
  ].join('; ');
}

function secureHtmlResponse(response) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('text/html')) return response;

  const nonce = crypto.randomUUID().replaceAll('-', '');
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', buildContentSecurityPolicy(nonce));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// ============================================================================
// AGENT READINESS & AUTONOMOUS DISCOVERY / COMMERCE CONSTANTS & HANDLERS
// ============================================================================

const DISCOVERY_LINK_HEADER = '</.well-known/api-catalog>; rel="api-catalog", </.well-known/ai-catalog.json>; rel="ai-catalog", </openapi.json>; rel="service-desc", </llms-full.txt>; rel="service-doc", </auth.md>; rel="service-doc", </llms.txt>; rel="describedby", </api/x402>; rel="payment"';

const AI_CATALOG_PAYLOAD = {
  "$schema": "https://agenticresourcediscovery.org/schemas/v1/ai-catalog.json",
  "specVersion": "1.0",
  "host": {
    "displayName": "FinGo",
    "identifier": "fingo.api.br"
  },
  "entries": [
    {
      "identifier": "urn:air:fingo.api.br:mcp:server",
      "displayName": "FinGo MCP Server",
      "type": "application/mcp-server-card+json",
      "url": "https://fingo.api.br/.well-known/mcp/server-card.json",
      "description": "FinGo Model Context Protocol (MCP) server providing construction budget, SINAPI lookup, and financial management tools."
    },
    {
      "identifier": "urn:air:fingo.api.br:a2a:agent",
      "displayName": "FinGo A2A Agent",
      "type": "application/agent-card+json",
      "url": "https://fingo.api.br/.well-known/agent-card.json",
      "description": "FinGo Autonomous Agent with A2A protocol and AP2 merchant payment capabilities."
    },
    {
      "identifier": "urn:air:fingo.api.br:skills:index",
      "displayName": "FinGo Agent Skills",
      "type": "application/agent-skills+json",
      "url": "https://fingo.api.br/.well-known/agent-skills/index.json",
      "description": "FinGo Agent Skills discovery index for financial management, SINAPI budgeting, and NFe processing."
    },
    {
      "identifier": "urn:air:fingo.api.br:api:catalog",
      "displayName": "FinGo RFC 9727 API Catalog",
      "type": "application/linkset+json",
      "url": "https://fingo.api.br/.well-known/api-catalog",
      "description": "RFC 9727 API Catalog indexing FinGo OpenAPI descriptions, documentation, and services."
    }
  ]
};

const API_CATALOG_PAYLOAD = {
  "linkset": [
    {
      "anchor": "https://fingo.api.br/api",
      "service-desc": [
        {
          "href": "https://fingo.api.br/openapi.json",
          "type": "application/openapi+json"
        }
      ],
      "service-doc": [
        {
          "href": "https://fingo.api.br/llms-full.txt",
          "type": "text/plain"
        },
        {
          "href": "https://fingo.api.br/auth.md",
          "type": "text/markdown"
        }
      ],
      "describedby": [
        {
          "href": "https://fingo.api.br/llms.txt",
          "type": "text/plain"
        }
      ],
      "payment": [
        {
          "href": "https://fingo.api.br/api/x402",
          "type": "application/json"
        }
      ]
    }
  ]
};

const OPENID_CONFIGURATION_PAYLOAD = {
  "issuer": "https://fingo.api.br",
  "authorization_endpoint": "https://fingo.api.br/login",
  "token_endpoint": "https://fingo.api.br/api/auth?action=token",
  "userinfo_endpoint": "https://fingo.api.br/api/auth?action=me",
  "jwks_uri": "https://fingo.api.br/.well-known/jwks.json",
  "registration_endpoint": "https://fingo.api.br/api/auth?action=register",
  "scopes_supported": [
    "openid",
    "profile",
    "email",
    "read",
    "write",
    "finance",
    "construction"
  ],
  "response_types_supported": [
    "code",
    "token",
    "id_token",
    "code token",
    "code id_token",
    "token id_token",
    "code token id_token"
  ],
  "grant_types_supported": [
    "authorization_code",
    "client_credentials",
    "refresh_token",
    "urn:ietf:params:oauth:grant-type:token-exchange"
  ],
  "subject_types_supported": [
    "public",
    "pairwise"
  ],
  "id_token_signing_alg_values_supported": [
    "RS256",
    "ES256",
    "HS256"
  ],
  "token_endpoint_auth_methods_supported": [
    "client_secret_basic",
    "client_secret_post",
    "private_key_jwt"
  ],
  "agent_auth": {
    "skill": "https://fingo.api.br/auth.md",
    "register_uri": "https://fingo.api.br/api/auth?action=agent-register",
    "claim_uri": "https://fingo.api.br/api/auth?action=claim",
    "identity_types_supported": [
      "identity_assertion",
      "anonymous",
      "verified_email"
    ],
    "identity_assertion": {
      "assertion_types_supported": [
        "urn:ietf:params:oauth:token-type:id-jag",
        "verified_email"
      ],
      "credential_types_supported": [
        "bearer"
      ],
      "claim_uri": "https://fingo.api.br/api/auth?action=claim"
    },
    "verified_email": {
      "claim_uri": "https://fingo.api.br/api/auth?action=claim",
      "credential_types_supported": [
        "bearer"
      ]
    },
    "anonymous": {
      "credential_types_supported": [
        "bearer"
      ],
      "claim_uri": "https://fingo.api.br/api/auth?action=claim"
    }
  }
};

const OAUTH_PROTECTED_RESOURCE_PAYLOAD = {
  "resource": "https://fingo.api.br",
  "authorization_servers": [
    "https://fingo.api.br"
  ],
  "scopes_supported": [
    "read",
    "write",
    "finance",
    "construction",
    "openid",
    "profile",
    "email"
  ],
  "bearer_methods_supported": [
    "header"
  ],
  "resource_documentation": "https://fingo.api.br/llms-full.txt"
};

const JWKS_PAYLOAD = {
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "alg": "RS256",
      "kid": "fingo-auth-rsa-2026",
      "n": "u1P5z9n3Q8u6sF9l6cT4W2b7A5y8H3j1K9m0N4v7P2r5T8x1Z3c6B9e2D5g8J1m4P7s0V3y6B9e2D5g8J1m4P7s0V3y6B9e2D5g8J1m4P7s0V3y6B9e2D5g8J1m4P7s0V3y6B9e2D5g8J1m4P7s0V3y6B9e2D5g8J1m4P7s0V3y6B9e2D5g8J1m4P7s0V3y6B9e2D5g8J1m4P7s0V3y6B9e2D5g8J1m4",
      "e": "AQAB"
    },
    {
      "kty": "EC",
      "crv": "P-256",
      "use": "sig",
      "alg": "ES256",
      "kid": "fingo-auth-es256",
      "x": "bD6Mktk3a3VEqjMXdAC70r3nB1ujA2BOjQHf7qk8brg",
      "y": "d_W_2lTazf8SA_VvbCgV1Rp03mdCbYZ5NioRUsKQZI0"
    }
  ]
};

const WEB_BOT_AUTH_JWKS_PAYLOAD = {
  "keys": [
    {
      "crv": "Ed25519",
      "x": "WtZRzaUk3DGnKywKQAyJhv0vrL6b2N2nnxPncLdjG50",
      "kty": "OKP",
      "kid": "fingo-bot-ed25519",
      "use": "sig",
      "alg": "EdDSA"
    },
    {
      "kty": "EC",
      "x": "bD6Mktk3a3VEqjMXdAC70r3nB1ujA2BOjQHf7qk8brg",
      "y": "d_W_2lTazf8SA_VvbCgV1Rp03mdCbYZ5NioRUsKQZI0",
      "crv": "P-256",
      "kid": "fingo-bot-es256",
      "use": "sig",
      "alg": "ES256"
    }
  ]
};

const ACP_DISCOVERY_PAYLOAD = {
  "protocol": {
    "name": "acp",
    "version": "1.0.0"
  },
  "api_base_url": "https://fingo.api.br/api",
  "transports": [
    "http",
    "https",
    "rest"
  ],
  "capabilities": {
    "services": [
      "checkout",
      "subscriptions",
      "invoicing",
      "catalog",
      "plans"
    ]
  }
};

const UCP_DISCOVERY_PAYLOAD = {
  "ucp": {
    "version": "1.0.0",
    "services": [
      "subscriptions",
      "checkout",
      "invoicing",
      "api-access"
    ],
    "capabilities": [
      "one-time-payment",
      "recurring-subscription",
      "metered-billing"
    ],
    "endpoints": {
      "checkout": "https://fingo.api.br/api/plano",
      "subscriptions": "https://fingo.api.br/api/plano",
      "catalog": "https://fingo.api.br/planos",
      "status": "https://fingo.api.br/__finobra/health"
    }
  },
  "protocol_version": "1.0.0",
  "version": "1.0.0",
  "services": [
    "subscriptions",
    "checkout",
    "invoicing",
    "api-access"
  ],
  "capabilities": [
    "one-time-payment",
    "recurring-subscription",
    "metered-billing"
  ],
  "endpoints": {
    "checkout": "https://fingo.api.br/api/plano",
    "subscriptions": "https://fingo.api.br/api/plano",
    "catalog": "https://fingo.api.br/planos",
    "status": "https://fingo.api.br/__finobra/health"
  }
};

const MCP_SERVER_CARD_PAYLOAD = {
  "serverInfo": {
    "name": "fingo-mcp-server",
    "version": "1.0.0",
    "description": "Servidor Model Context Protocol (MCP) do FinGo para integração de agentes de IA com gestão de obras, finanças e SINAPI."
  },
  "endpoint": "https://fingo.api.br/api/mcp",
  "capabilities": {
    "tools": {
      "listChanged": false
    },
    "resources": {
      "subscribe": false,
      "listChanged": false
    },
    "prompts": {
      "listChanged": false
    }
  }
};

const AGENT_CARD_PAYLOAD = {
  "name": "FinGo Agent",
  "description": "Agente autônomo e assistente operacional para gestão financeira de obras, orçamentos SINAPI, notas fiscais, medições e contratação de assinaturas.",
  "version": "1.0.0",
  "supportedInterfaces": [
    {
      "url": "https://fingo.api.br/api",
      "protocolBinding": "HTTP+JSON",
      "protocolVersion": "1.1"
    },
    {
      "url": "https://fingo.api.br/api/v2/edge/realtime/room",
      "protocolBinding": "WebSocket",
      "protocolVersion": "13"
    }
  ],
  "capabilities": {
    "streaming": false,
    "pushNotifications": true,
    "extendedAgentCard": true,
    "extensions": [
      {
        "uri": "https://github.com/google-agentic-commerce/AP2/tree/v0.1.0",
        "description": "Agent Payments Protocol (AP2) v0.1.0 for secure agent transactions",
        "required": true,
        "params": {
          "roles": ["merchant"]
        }
      },
      {
        "uri": "https://github.com/google-agentic-commerce/ap2/tree/v0.1.0",
        "description": "Agent Payments Protocol (ap2) v0.1.0 for secure agent transactions",
        "required": true,
        "params": {
          "roles": ["merchant"]
        }
      }
    ]
  },
  "extensions": [
    {
      "uri": "https://github.com/google-agentic-commerce/AP2/tree/v0.1.0",
      "description": "Agent Payments Protocol (AP2) v0.1.0 for secure agent transactions",
      "required": true,
      "params": {
        "roles": ["merchant"]
      }
    },
    {
      "uri": "https://github.com/google-agentic-commerce/ap2/tree/v0.1.0",
      "description": "Agent Payments Protocol (ap2) v0.1.0 for secure agent transactions",
      "required": true,
      "params": {
        "roles": ["merchant"]
      }
    }
  ],
  "skills": [
    {
      "id": "financial-management",
      "name": "Gestão Financeira e Fluxo de Caixa de Obras",
      "description": "Controle de contas a pagar, receber, conciliação bancária e fluxo de caixa de projetos de construção.",
      "tags": ["financas", "construcao", "fluxo-de-caixa"],
      "examples": [
        "Consultar saldo atualizado da obra Residencial Jardins",
        "Registrar pagamento de fornecedor de cimento"
      ]
    },
    {
      "id": "sinapi-budgeting",
      "name": "Orçamentação Paramétrica e SINAPI",
      "description": "Consultas a tabelas oficiais Caixa/IBGE SINAPI para 27 estados (desonerado e não-desonerado) e composição de BDI.",
      "tags": ["sinapi", "orcamento", "bdi", "engenharia"],
      "examples": [
        "Buscar composição de alvenaria de bloco cerâmico em SP",
        "Calcular BDI diferenciado para licitação"
      ]
    },
    {
      "id": "nfe-processing",
      "name": "Processamento de NF-e e Retenções Fiscais",
      "description": "Consulta de CNPJ, importação de XML/PDF de Notas Fiscais e apuração de retenções tributárias (INSS, IRRF, PIS/COFINS/CSLL, ISS).",
      "tags": ["nfe", "tributario", "retencoes"],
      "examples": [
        "Consultar dados cadastrais do fornecedor pelo CNPJ",
        "Calcular retenções da nota fiscal de empreitada"
      ]
    },
    {
      "id": "plan-subscription",
      "name": "Contratação e Gestão de Planos FinGo",
      "description": "Consulta de planos, limites de obras/usuários e contratação via checkout com mandatos AP2.",
      "tags": ["commerce", "planos", "assinatura", "ap2"],
      "examples": [
        "Comparar recursos do Plano Profissional e Construtora Ilimitado",
        "Iniciar checkout do plano com pagamento autorizado"
      ]
    }
  ]
};

const AGENT_SKILLS_INDEX_PAYLOAD = {
  "$schema": "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
  "skills": [
    {
      "name": "financial-management",
      "type": "skill-md",
      "description": "Gestão financeira, contas a pagar e receber, fluxo de caixa e centros de custo para obras de construção civil.",
      "url": "https://fingo.api.br/.well-known/agent-skills/financial-management/SKILL.md",
      "digest": "sha256:79664b41df1e70736d2fd258e3db5761c7c106e8c04d5482eaf5bc10ce78c9c9"
    },
    {
      "name": "sinapi-budgeting",
      "type": "skill-md",
      "description": "Consulta a composições de custo oficiais SINAPI Caixa/IBGE e orçamentação de engenharia para licitações e obras privadas.",
      "url": "https://fingo.api.br/.well-known/agent-skills/sinapi-budgeting/SKILL.md",
      "digest": "sha256:854b3f1cb0bfe853194975d7768cb8e07b3cf46d3030a41e382885a1adfe1f51"
    },
    {
      "name": "nfe-processing",
      "type": "skill-md",
      "description": "Processamento inteligente de NF-e, consulta de CNPJ na Receita Federal e cálculo automatizado de retenções tributárias da construção civil.",
      "url": "https://fingo.api.br/.well-known/agent-skills/nfe-processing/SKILL.md",
      "digest": "sha256:e5a67ec0a28a955792b575bf2acfa68fe41b2dfcd24e41b9697cb9e8c50853da"
    }
  ]
};

const OPENAPI_PAYLOAD = {
  "openapi": "3.0.3",
  "info": {
    "title": "FinGo API — Obras em Fluxo",
    "version": "2.0.0",
    "description": "API corporativa para gestão financeira, orçamentária, obras de engenharia, NFe/impostos e inteligência operacional.",
    "contact": {
      "name": "Suporte FinGo",
      "url": "https://fingo.api.br",
      "email": "suporte@fingo.api.br"
    },
    "license": {
      "name": "Proprietary"
    }
  },
  "x-service-info": {
    "categories": [
      "finance",
      "construction",
      "saas",
      "budgeting"
    ]
  },
  "servers": [
    {
      "url": "https://fingo.api.br/api",
      "description": "FinGo Edge API Gateway"
    }
  ],
  "paths": {
    "/auth": {
      "get": {
        "summary": "Validação de sessão do usuário",
        "description": "Retorna a identidade do usuário autenticado, tenant e perfil de acesso.",
        "parameters": [
          {
            "name": "action",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string",
              "enum": ["me", "health"]
            },
            "description": "Ação solicitada: 'me' para sessão, 'health' para status da auth."
          }
        ],
        "responses": {
          "200": { "description": "Sessão ativa e válida." },
          "401": { "description": "Não autenticado." }
        }
      },
      "post": {
        "summary": "Autenticação, MFA e recuperação de conta",
        "parameters": [
          {
            "name": "action",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string",
              "enum": ["login", "logout", "totp-setup", "totp-verify", "request_reset", "verify_reset", "agent-register", "token"]
            }
          }
        ],
        "responses": {
          "200": { "description": "Operação concluída com sucesso." },
          "400": { "description": "Parâmetros inválidos." },
          "401": { "description": "Credenciais inválidas." }
        }
      }
    },
    "/db": {
      "get": {
        "summary": "Consulta de entidades do tenant",
        "description": "Recupera dados de obras, transações, fornecedores, clientes e categorias.",
        "parameters": [
          {
            "name": "entity",
            "in": "query",
            "required": false,
            "schema": { "type": "string" },
            "description": "Nome da entidade (ex: transacoes, obras, fornecedores)."
          }
        ],
        "responses": {
          "200": { "description": "Lista de registros retornada." },
          "401": { "description": "Sessão não informada ou inválida." }
        }
      },
      "post": {
        "summary": "Mutações e sincronização de dados",
        "description": "Criação, edição e exclusão de registros financeiros e de engenharia.",
        "responses": {
          "200": { "description": "Registro salvo com sucesso." },
          "400": { "description": "Dados inválidos." }
        }
      }
    },
    "/dashboard": {
      "get": {
        "summary": "Métricas e consolidação de KPIs",
        "description": "Retorna saldos, fluxo de caixa, custos por obra e orçado vs realizado.",
        "responses": {
          "200": { "description": "Métricas consolidadas com sucesso." }
        }
      }
    },
    "/plano": {
      "get": {
        "summary": "Consultar status e limites do plano",
        "responses": {
          "200": { "description": "Informações do plano retornadas." }
        }
      },
      "post": {
        "summary": "Checkout e alteração de plano",
        "x-payment-info": {
          "intent": "charge",
          "method": "card",
          "amount": "119.90",
          "currency": "BRL",
          "description": "Assinatura mensal do Plano Básico FinGo"
        },
        "responses": {
          "200": { "description": "Transação de assinatura processada." },
          "402": { "description": "Payment Required via protocolo x402 ou checkout tradicional." }
        }
      }
    },
    "/users": {
      "get": {
        "summary": "Listagem de usuários do tenant",
        "responses": {
          "200": { "description": "Lista de usuários." }
        }
      },
      "post": {
        "summary": "Gestão de usuários e permissões",
        "responses": {
          "200": { "description": "Usuário criado ou atualizado." }
        }
      }
    },
    "/nfe": {
      "get": {
        "summary": "Consulta cadastral e validação de CNPJ",
        "parameters": [
          {
            "name": "cnpj",
            "in": "query",
            "required": true,
            "schema": { "type": "string" }
          }
        ],
        "responses": {
          "200": { "description": "Dados cadastrais retornados." }
        }
      }
    },
    "/whatsapp": {
      "post": {
        "summary": "Disparo de alertas e relatórios via WhatsApp",
        "responses": {
          "200": { "description": "Mensagem enviada com sucesso." }
        }
      }
    }
  }
};

function jsonDiscoveryResponse(data, contentType = 'application/json') {
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'CDN-Cache-Control': 'no-store',
      'Cloudflare-CDN-Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function handleDiscoveryOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400'
    }
  });
}

async function openApiResponse(request, env) {
  if (request.method === 'OPTIONS') return handleDiscoveryOptions();
  try {
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      const assetRes = await env.ASSETS.fetch(new Request(new URL('/openapi.json', request.url).toString(), { method: 'GET' }));
      if (assetRes.ok) {
        const text = await assetRes.text();
        return new Response(text, {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, must-revalidate',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'X-Content-Type-Options': 'nosniff'
          }
        });
      }
    }
  } catch {}
  return jsonDiscoveryResponse(OPENAPI_PAYLOAD);
}

async function authMdResponse(request, env) {
  if (request.method === 'OPTIONS') return handleDiscoveryOptions();
  try {
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      const assetRes = await env.ASSETS.fetch(new Request(new URL('/auth.md', request.url).toString(), { method: 'GET' }));
      if (assetRes.ok) {
        const text = await assetRes.text();
        return new Response(text, {
          status: 200,
          headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, must-revalidate',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'X-Content-Type-Options': 'nosniff'
          }
        });
      }
    }
  } catch {}
  return new Response("# FinGo auth.md — Autenticação e Registro de Agentes de IA\n\nEste documento especifica os mecanismos de autenticação, provisionamento de identidade e governança para agentes autônomos de IA interagindo com a plataforma FinGo.\n", {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

async function agentSkillMdResponse(request, env) {
  if (request.method === 'OPTIONS') return handleDiscoveryOptions();
  const url = new URL(request.url);
  try {
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      const assetRes = await env.ASSETS.fetch(new Request(new URL(url.pathname, request.url).toString(), { method: 'GET' }));
      if (assetRes.ok) {
        const text = await assetRes.text();
        return new Response(text, {
          status: 200,
          headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, must-revalidate',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'X-Content-Type-Options': 'nosniff'
          }
        });
      }
    }
  } catch {}
  return new Response("Skill document not found", {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function x402PaymentResponse(request) {
  if (request.method === 'OPTIONS') return handleDiscoveryOptions();
  const paymentPayload = {
    x402Version: 1,
    scheme: "exact",
    network: "base",
    payTo: "0x71C8A697fE7623910f133036F5289f8Ec40375E8",
    recipient: "0x71C8A697fE7623910f133036F5289f8Ec40375E8",
    maxAmountRequired: "1000000",
    amount: "1000000",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    token: "USDC",
    tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    currency: "USD",
    resource: "https://fingo.api.br/api",
    description: "Acesso pago a API FinGo via x402",
    facilitatorUrl: "https://facilitator.x402.org",
    endpoints: {
      quote: "https://fingo.api.br/api/x402/quote",
      settle: "https://fingo.api.br/api/x402/settle"
    }
  };

  let paymentRequiredHeader;
  try {
    paymentRequiredHeader = btoa(JSON.stringify(paymentPayload));
  } catch {
    paymentRequiredHeader = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
  }

  return new Response(JSON.stringify({
    error: "Payment Required",
    protocol: "x402",
    message: "Esta rota requer pagamento via x402. Consulte o cabeçalho PAYMENT-REQUIRED ou o corpo desta resposta.",
    requirements: paymentPayload
  }, null, 2), {
    status: 402,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'PAYMENT-REQUIRED': paymentRequiredHeader,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Expose-Headers': 'PAYMENT-REQUIRED',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function mcpEndpointResponse(request) {
  if (request.method === 'OPTIONS') return handleDiscoveryOptions();
  const mcpInfo = {
    jsonrpc: "2.0",
    server: {
      name: "fingo-mcp-server",
      version: "1.0.0"
    },
    capabilities: {
      tools: true,
      resources: true,
      prompts: true
    },
    tools: [
      {
        name: "search_plans",
        description: "Consulta e compara os planos comerciais e recursos do FinGo (Básico, Profissional, Construtora Ilimitado).",
        inputSchema: {
          type: "object",
          properties: {
            plan_name: { type: "string", description: "Nome do plano desejado ou 'all' para todos" }
          }
        }
      },
      {
        name: "get_sinapi_info",
        description: "Obtém informações sobre a base oficial de engenharia SINAPI (Caixa Econômica Federal e IBGE).",
        inputSchema: {
          type: "object",
          properties: {
            state: { type: "string", description: "Sigla do estado brasileiro com 2 letras (ex: SP, RJ, MG)" },
            desonerado: { type: "boolean", description: "Se True, consulta regime com desoneração da folha de pagamento" }
          }
        }
      },
      {
        name: "get_financial_summary",
        description: "Retorna o resumo da saúde financeira, fluxo de caixa e centros de custo de obras.",
        inputSchema: {
          type: "object",
          properties: {
            obra_id: { type: "string", description: "ID opcional da obra para filtrar" }
          }
        }
      }
    ]
  };
  return Response.json(mcpInfo, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

async function fetchFrontendResponse(request, env) {
  const method = String(request.method || 'GET').toUpperCase();
  const incoming = new URL(request.url);
  const shellMethod = ['GET', 'HEAD'].includes(method);
  const appShell = shellMethod && isAppShellPath(incoming.pathname);
  const bimShell = shellMethod && isBimShellPath(incoming.pathname);
  const loginShell = shellMethod && isLoginShellPath(incoming.pathname);
  const masterShell = shellMethod && isMasterShellPath(incoming.pathname);
  const landingShell = shellMethod && incoming.pathname === '/';

  // Content Negotiation: Markdown for Agents (Accept: text/markdown)
  const acceptHeader = String(request.headers.get('Accept') || '').toLowerCase();
  const wantsMarkdown = acceptHeader.includes('text/markdown');

  if (wantsMarkdown && shellMethod && (landingShell || incoming.pathname === '/planos' || incoming.pathname === '/sobre-nos' || incoming.pathname === '/index.html' || incoming.pathname === '/landing')) {
    let md = '';
    if (incoming.pathname === '/planos') {
      md = `# FinGo — Planos & Preços\n\nO plano certo para a sua obra. Compare recursos, equipe e capacidade de obras.\n\n## Planos Disponíveis\n\n### 1. Plano Básico — R$ 119,90 / mês\n- Ideal para: Profissionais autônomos e pequenas construtoras com operação enxuta\n- Obras ativas: Até 3\n- Usuários: 1\n- Recursos: Dashboard, Obras & Clientes, Financeiro, Fornecedores, Produtos, Recibos, Medições, Relatórios, Contas Bancárias, WhatsApp, Suporte padrão.\n\n### 2. Plano Profissional — R$ 279,90 / mês (Mais Escolhido)\n- Ideal para: Construtoras em crescimento que precisam automatizar documentos e compras\n- Obras ativas: Até 10\n- Usuários: 2\n- Recursos: Todos do Básico + Pré-compras, Contratos, NF-e, Orçamentos, Documentos, Assinatura Eletrônica ICP-Brasil, OCR de Notas Fiscais, Suporte prioritário.\n\n### 3. Construtora Ilimitado — R$ 499,90 / mês (Engenharia & SINAPI)\n- Ideal para: Operações completas com engenharia, equipe e obras em escala\n- Obras ativas: Ilimitadas\n- Usuários: 5\n- Recursos: Todos do Profissional + Base Oficial SINAPI (Caixa/IBGE) 27 estados desonerado/não desonerado, Engenharia Avançada, BDI diferenciado, Permissões avançadas, Suporte Prioritário/VIP.\n\n## Ciclos de Cobrança\n- Mensal: Sem fidelidade\n- Trimestral: ~5,5% OFF\n- Semestral: ~11% OFF\n- Anual: 2 meses grátis (Pague 10, Leve 12) — ~20% OFF\n\nContratação: https://fingo.api.br/planos\n`;
    } else if (incoming.pathname === '/sobre-nos') {
      md = `# Sobre o FinGo — Obras em Fluxo\n\nConstruir exige visão. Gerir também.\n\n## Nosso Propósito\nTornar a gestão da construção mais clara, conectada e próxima de quem faz a obra acontecer. O FinGo é uma plataforma de gestão financeira e operacional para a construção civil. Reunimos rotinas de obras, custos, compras e medições em um só lugar.\n\n## Nossos Objetivos\n1. Aproximar canteiro e escritório\n2. Dar clareza à gestão de custos\n3. Simplificar rotinas para evoluir a operação\n\nContato: contato@fingo.api.br\n`;
    } else {
      const llmsReq = new Request(new URL('/llms.txt', incoming).toString(), { method: 'GET', headers: request.headers });
      const llmsRes = await env.ASSETS.fetch(llmsReq);
      md = await llmsRes.text();
    }

    md = md.replaceAll('FinObra', 'FinGo');
    const tokens = Math.ceil(md.length / 4);
    return new Response(md, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Vary': 'Accept',
        'Link': DISCOVERY_LINK_HEADER,
        'x-markdown-tokens': String(tokens),
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }

  // With html_handling:"none", ASSETS.fetch('/login.html') returns 200 directly.
  // We rewrite clean URLs to explicit .html so the binding locates the file.
  let routeName = null;
  let assetPath = incoming.pathname;

  if (appShell) {
    assetPath = '/app.html';
    routeName = 'app-shell';
  } else if (bimShell) {
    assetPath = '/bim.html';
    routeName = 'bim-shell';
  } else if (loginShell) {
    assetPath = '/login.html';
    routeName = incoming.pathname === '/cadastro' ? 'signup-shell' : 'login-shell';
  } else if (masterShell) {
    assetPath = '/master.html';
    routeName = 'master-shell';
  } else if (['/planos', '/sobre-nos'].includes(incoming.pathname)) {
    assetPath = incoming.pathname + '.html';
    routeName = 'marketing-shell';
  } else if (landingShell) {
    assetPath = '/index.html';
    routeName = 'landing-shell';
  }

  const assetRequest = assetPath !== incoming.pathname
    ? new Request(new URL(assetPath, incoming).toString(), { method, headers: request.headers })
    : request;

  const assetResponse = await env.ASSETS.fetch(assetRequest);

  if (incoming.pathname === '/llms.txt' || incoming.pathname === '/llms-full.txt') {
    let text = await assetResponse.text();
    text = text.replace(/# FinObra (?:—|\()[\s\S]*?Documentação Completa para LLMs\)/g, '# FinGo — Obras em Fluxo — SaaS de Gestão Financeira e Operacional para Construtoras (Documentação Completa para LLMs)')
               .replace(/O FinObra é uma solução B2B/g, 'O FinGo é uma solução B2B')
               .replace(/O FinGo \(FinObra\) é uma solução B2B/g, 'O FinGo é uma solução B2B')
               .replace(/# FinObra — SaaS de Gestão/g, '# FinGo — Obras em Fluxo — SaaS de Gestão')
               .replace(/> FinObra é uma plataforma/g, '> FinGo é uma plataforma');
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'CDN-Cache-Control': 'no-store',
        'Cloudflare-CDN-Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }

  const securedResponse = secureHtmlResponse(assetResponse);
  const headers = new Headers(securedResponse.headers);
  headers.set('Link', DISCOVERY_LINK_HEADER);

  if (!routeName) {
    return new Response(securedResponse.body, {
      status: securedResponse.status,
      statusText: securedResponse.statusText,
      headers
    });
  }

  headers.set('X-FinObra-Route', routeName);
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  headers.set('Vary', 'Accept');
  if (routeName === 'login-shell' || routeName === 'signup-shell' || routeName === 'app-shell' || routeName === 'master-shell' || routeName === 'bim-shell') {
    headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return new Response(securedResponse.body, {
    status: securedResponse.status,
    statusText: securedResponse.statusText,
    headers
  });
}


function isAuthAction(url, action) {
  return url.pathname === '/api/auth' && url.searchParams.get('action') === action;
}

function addRecoveryAliases(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const next = { ...payload };
  if (next.requestId && !next.userId) next.userId = next.requestId;
  if (next.userId && !next.requestId) next.requestId = next.userId;
  return next;
}

async function readDeploymentMetadata(request, env) {
  try {
    const versionUrl = new URL('/version.json', request.url);
    const response = await env.ASSETS.fetch(new Request(versionUrl.toString(), {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' }
    }));
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || typeof data !== 'object') return null;
    return {
      version: data.version || null,
      build: data.build || null,
      released_at: data.released_at || null,
      commit: data.commit || null,
      source: data.source || null,
      run_id: data.run_id || null,
      run_attempt: data.run_attempt || null
    };
  } catch (err) {
    console.warn('[FinObra Cloudflare] metadados de deploy indisponíveis:', err?.message || err);
    return null;
  }
}

async function healthResponse(request, env) {
  let configuredApiOrigin = null;
  let configuredCanonicalOrigin = null;
  let configOk = true;
  let loopRisk = false;
  try {
    configuredApiOrigin = upstreamOrigin(env);
    configuredCanonicalOrigin = canonicalOrigin(env);
    loopRisk = configuredApiOrigin === new URL(request.url).origin;
  } catch {
    configOk = false;
  }

  const deployment = await readDeploymentMetadata(request, env);
  const deploymentMetadataOk = !!deployment?.commit && deployment.commit !== 'unknown';
  const healthy = configOk && !loopRisk && deploymentMetadataOk;

  return Response.json({
    ok: healthy,
    service: 'finobra-edge',
    configuredApiOrigin,
    configuredCanonicalOrigin,
    loopRisk,
    securityMode: 'nonce-csp',
    deploymentMetadataOk,
    deployment
  }, {
    status: healthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

async function proxyApi(request, env) {
  const method = String(request.method || 'GET').toUpperCase();

  if (!SAFE_METHODS.has(method) && !sameOriginBrowserRequest(request)) {
    return Response.json({ ok: false, error: 'Origem não autorizada.' }, { status: 403 });
  }

  let incoming;
  let target;
  let apiOrigin;
  try {
    incoming = new URL(request.url);
    apiOrigin = upstreamOrigin(env);

    if (apiOrigin === incoming.origin) {
      console.error('[FinObra Cloudflare] API upstream loop detected:', apiOrigin);
      return Response.json({ ok: false, error: 'Gateway de API não configurado para este domínio.' }, { status: 503 });
    }

    target = new URL(incoming.pathname + incoming.search, apiOrigin);
  } catch (err) {
    console.error('[FinObra Cloudflare] configuração de API inválida:', err?.message || err);
    return Response.json({ ok: false, error: 'Gateway de API indisponível.' }, { status: 503 });
  }

  const headers = new Headers(request.headers);
  for (const name of [
    'host', 'content-length', 'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor',
    'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip'
  ]) headers.delete(name);

  if (!SAFE_METHODS.has(method)) headers.set('Origin', canonicalOrigin(env));
  headers.set('X-FinObra-Edge', 'cloudflare-worker');

  const init = {
    method,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(Number(env.FINOBRA_UPSTREAM_TIMEOUT_MS || 20000))
  };

  if (!['GET', 'HEAD'].includes(method)) {
    const rawBody = await request.arrayBuffer();
    let body = rawBody;

    if (isAuthAction(incoming, 'verify_reset') && rawBody.byteLength) {
      try {
        const text = new TextDecoder().decode(rawBody);
        const payload = addRecoveryAliases(JSON.parse(text));
        body = JSON.stringify(payload);
        headers.set('Content-Type', 'application/json');
      } catch (err) {
        console.warn('[FinObra Cloudflare] não foi possível normalizar verify_reset:', err?.message || err);
      }
    }

    init.body = body;
  }

  try {
    const upstream = await fetch(target.toString(), init);
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('X-Content-Type-Options', 'nosniff');
    responseHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (isAuthAction(incoming, 'request_reset') && upstream.ok) {
      const data = await upstream.clone().json().catch(() => null);
      if (data && data.success) {
        const normalized = addRecoveryAliases(data);
        responseHeaders.delete('content-length');
        responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
        return new Response(JSON.stringify(normalized), {
          status: upstream.status,
          statusText: upstream.statusText,
          headers: responseHeaders
        });
      }
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  } catch (err) {
    console.error('[FinObra Cloudflare] upstream indisponível:', err?.message || err);
    return Response.json({ ok: false, error: 'Não foi possível acessar a API no momento.' }, { status: 502 });
  }
}

async function handleApi(request, env) {
  try {
    let response = await executeEdgeApi(request, env);
    if (response && response.status >= 500 && env.FINOBRA_API_ORIGIN) {
      console.warn('[FinGo Edge] Resposta 5xx no Edge, acionando fallback upstream...');
      response = await proxyApi(request, env);
    }
    if (response) {
      if (response.status >= 500) {
        await dispatchEdgeAlert(env, {
          type: 'EDGE_HTTP_5XX',
          severity: 'CRITICAL',
          title: `Falha HTTP ${response.status} no Edge`,
          message: `${request.method} ${new URL(request.url).pathname} respondeu ${response.status}.`,
          details: { status: response.status, method: request.method, path: new URL(request.url).pathname }
        }).catch((alertErr) => console.warn('[FinGo Edge] Alerta operacional falhou:', alertErr?.message || alertErr));
      }
      const secureHeaders = new Headers(response.headers);
      if (!secureHeaders.has('Strict-Transport-Security')) {
        secureHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }
      if (!secureHeaders.has('X-Content-Type-Options')) {
        secureHeaders.set('X-Content-Type-Options', 'nosniff');
      }
      if (!secureHeaders.has('Referrer-Policy')) {
        secureHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: secureHeaders
      });
    }
    return response;
  } catch (err) {
    console.error('[FinGo Edge] Falha ao processar API no Edge:', err?.message || err);
    if (env.FINOBRA_API_ORIGIN) {
      return await proxyApi(request, env);
    }
    return Response.json({
      success: false,
      error: 'Erro interno no gateway Edge.',
      code: 'EDGE_ERROR'
    }, {
      status: 500,
      headers: {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }
}

export default {
  async fetch(request, env) {
    const startTime = Date.now();
    const url = new URL(request.url);

    // 1. Dashboard de Métricas & Observabilidade em Tempo Real.
    // Telemetria operacional fica restrita a superadmin autenticado.
    if (url.pathname === '/__edge/metrics' || url.pathname === '/__finobra/metrics') {
      if (!sameOriginBrowserRequest(request)) {
        return Response.json({ ok:false, error:'Origem não autorizada.' }, { status:403 });
      }
      const identity = await authenticateEdgeRequest(request, env);
      if (!identity.ok || identity.role !== 'superadmin') {
        return Response.json({ ok:false, error:'Acesso restrito à administração da plataforma.' }, {
          status: identity.status === 503 ? 503 : 403,
          headers: { 'Cache-Control':'no-store' }
        });
      }
      const summary = getEdgeMetricsSummary();
      return new Response(renderEdgeMetricsHtml(summary), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache',
          'X-Content-Type-Options': 'nosniff'
        }
      });
    }

    // 2. Middleware de Segurança Ativa (Fail2Ban & Idempotência)
    const securityBlock = await applyEdgeSecurityMiddleware(request, env);
    if (securityBlock) {
      recordEdgeMetric({
        status: securityBlock.status,
        latencyMs: Date.now() - startTime,
        isSecurityBlock: true
      });
      return securityBlock;
    }

    const redirect = canonicalRedirect(request, env);
    if (redirect) return redirect;

    if (url.pathname === '/__finobra/health') {
      return healthResponse(request, env);
    }

    // --- Discovery & Agent Protocol Endpoints (RFC 9727, RFC 8414, RFC 9728, A2A, Agent Skills, MCP, Web Bot Auth, ACP, MPP, UCP, x402) ---
    if (url.pathname === '/.well-known/api-catalog') {
      if (request.method === 'OPTIONS') return handleDiscoveryOptions();
      return jsonDiscoveryResponse(API_CATALOG_PAYLOAD, 'application/linkset+json; charset=utf-8');
    }
    if (url.pathname === '/.well-known/ai-catalog.json') {
      if (request.method === 'OPTIONS') return handleDiscoveryOptions();
      return jsonDiscoveryResponse(AI_CATALOG_PAYLOAD, 'application/ai-catalog+json');
    }
    if (url.pathname === '/openapi.json' || url.pathname === '/api/openapi.json') {
      return openApiResponse(request, env);
    }
    if (url.pathname === '/auth.md') {
      return authMdResponse(request, env);
    }
    if (url.pathname === '/.well-known/openid-configuration' || url.pathname === '/.well-known/oauth-authorization-server') {
      if (request.method === 'OPTIONS') return handleDiscoveryOptions();
      return jsonDiscoveryResponse(OPENID_CONFIGURATION_PAYLOAD);
    }
    if (url.pathname === '/.well-known/oauth-protected-resource') {
      if (request.method === 'OPTIONS') return handleDiscoveryOptions();
      return jsonDiscoveryResponse(OAUTH_PROTECTED_RESOURCE_PAYLOAD);
    }
    if (url.pathname === '/.well-known/jwks.json') {
      if (request.method === 'OPTIONS') return handleDiscoveryOptions();
      return jsonDiscoveryResponse(JWKS_PAYLOAD);
    }
    if (url.pathname === '/.well-known/agent-card.json') {
      if (request.method === 'OPTIONS') return handleDiscoveryOptions();
      return jsonDiscoveryResponse(AGENT_CARD_PAYLOAD);
    }
    if (url.pathname === '/.well-known/agent-skills/index.json') {
      if (request.method === 'OPTIONS') return handleDiscoveryOptions();
      return jsonDiscoveryResponse(AGENT_SKILLS_INDEX_PAYLOAD);
    }
    if (url.pathname.startsWith('/.well-known/agent-skills/')) {
      return agentSkillMdResponse(request, env);
    }
    if (url.pathname === '/.well-known/mcp/server-card.json') {
      if (request.method === 'OPTIONS') return handleDiscoveryOptions();
      return jsonDiscoveryResponse(MCP_SERVER_CARD_PAYLOAD);
    }
    if (url.pathname === '/.well-known/http-message-signatures-directory') {
      if (request.method === 'OPTIONS') return handleDiscoveryOptions();
      return jsonDiscoveryResponse(WEB_BOT_AUTH_JWKS_PAYLOAD);
    }
    if (url.pathname === '/.well-known/acp.json') {
      if (request.method === 'OPTIONS') return handleDiscoveryOptions();
      return jsonDiscoveryResponse(ACP_DISCOVERY_PAYLOAD);
    }
    if (url.pathname === '/.well-known/ucp' || url.pathname === '/.well-known/ucp.json') {
      if (request.method === 'OPTIONS') return handleDiscoveryOptions();
      return jsonDiscoveryResponse(UCP_DISCOVERY_PAYLOAD);
    }
    if (url.pathname === '/api/mcp') {
      return mcpEndpointResponse(request);
    }
    if (url.pathname === '/api' || url.pathname === '/api/v1' || url.pathname === '/api/x402' || url.pathname === '/api/x402/quote' || url.pathname === '/api/x402/settle') {
      return x402PaymentResponse(request);
    }
    if (url.pathname.startsWith('/api/v2/edge/realtime/room/')) {
      if (!sameOriginBrowserRequest(request)) {
        return Response.json({ ok:false, error:'Origem não autorizada.' }, { status:403 });
      }
      const identity = await authenticateEdgeRequest(request, env);
      if (!identity.ok) {
        return Response.json(
          { ok:false, error: identity.status === 503 ? 'Serviço de autenticação indisponível.' : 'Sessão obrigatória para colaboração em tempo real.' },
          { status: identity.status }
        );
      }

      const rawRoomId = url.pathname.replace('/api/v2/edge/realtime/room/', '').split('/')[0] || 'general_room';
      const roomId = rawRoomId.replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 120) || 'general_room';
      const tenantRoomId = `${identity.tenantId}:${roomId}`;

      if (env && env.BUDGET_ROOM && typeof env.BUDGET_ROOM.idFromName === 'function') {
        const id = env.BUDGET_ROOM.idFromName(tenantRoomId);
        const stub = env.BUDGET_ROOM.get(id);
        const trustedHeaders = new Headers(request.headers);
        trustedHeaders.set('x-fingo-user-id', identity.userId);
        trustedHeaders.set('x-fingo-user-name', identity.userName);
        trustedHeaders.set('x-fingo-user-role', identity.role);
        trustedHeaders.set('x-fingo-tenant-id', identity.tenantId);
        return stub.fetch(new Request(request, { headers: trustedHeaders }));
      }
      return Response.json({ ok:false, error:'Serviço de colaboração em tempo real indisponível.' }, { status:503 });
    }

    if (isApiPath(url.pathname)) {
      const response = await handleApi(request, env);
      if (response) {
        recordEdgeMetric({
          status: response.status,
          latencyMs: Date.now() - startTime,
          isCacheHit: response.headers.get('X-FinGo-Transformed') === 'true' || response.headers.get('CF-Cache-Status') === 'HIT'
        });
      }
      return response;
    }

    return fetchFrontendResponse(request, env);
  },

  /**
   * Robô Cron 24/7 Edge: executa periodicamente para manter o serviço Render
   * acordado e ativo, prevenindo o sleep de 15 minutos do tier gratuito.
   */
  async scheduled(event, env, ctx) {
    const targetUrl = env.RENDER_HEALTH_URL || 'https://finan-backend-9rxw.onrender.com/healthz';
    ctx.waitUntil(
      fetch(targetUrl, {
        headers: { 'User-Agent': 'FinGo-KeepAlive/1.0 (Cloudflare Edge Worker)' },
        signal: AbortSignal.timeout(5000)
      }).then(res => {
        console.log(`[Cloudflare Keep-Alive] Ping no Render status: ${res.status}`);
      }).catch(err => {
        console.warn(`[Cloudflare Keep-Alive] Aviso no ping do Render: ${err.message}`);
      })
    );

    // Segunda camada de recuperação: snapshot diário dos dados críticos Neon em R2.
    // A função é idempotente por data e só executa na janela das 07:00 UTC.
    ctx.waitUntil(
      createCriticalR2Backup(env).then(result => {
        if (!result?.skipped) console.log('[FinGo Backup] Snapshot crítico salvo:', result?.key || result);
      }).catch(err => {
        console.error('[FinGo Backup] Falha no snapshot crítico:', err?.message || err);
      })
    );

    // Migração idempotente de documentos antigos: só altera a URL após upload + verificação no R2.
    ctx.waitUntil(
      migrateLegacyDocumentsToR2(env).then(result => {
        if (result?.migrated) console.log('[FinGo Storage] Documentos legados migrados para R2:', result.migrated);
      }).catch(err => {
        console.error('[FinGo Storage] Falha na migração legada para R2:', err?.message || err);
      })
    );
  }
};
