// api/nfe.js — Proxy Serverless Seguro para Consulta de NF-e via API MeuDanfe

import { resolveAuthAndTenant } from './_auth.js';

const ALLOWED_ORIGINS = [
  'https://finobra.app.br',
  'https://www.finobra.app.br',
  'http://localhost:3000',
  'http://localhost:3333',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3333',
  'http://127.0.0.1:5000'
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app');
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, apikey, x-tenant-id');
}

const MEUDANFE_BASE = 'https://api.meudanfe.com.br/v2';

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Exige autenticação rigorosa
  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({
      success: false,
      error: auth.error || 'Acesso não autorizado para consulta de NF-e.'
    });
  }

  // Chave protegida no servidor (ambiente .env)
  const apiKey = (process.env.MEUDANFE_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'Serviço de consulta de NF-e não configurado no servidor (MEUDANFE_API_KEY pendente).'
    });
  }
  const mdHeaders = {
    'Api-Key': apiKey,
    'Accept': 'application/json'
  };

  try {
    const action = req.query.action || (req.body && req.body.action);
    const chave = (req.query.chave || (req.body && req.body.chave) || '').toString().replace(/\D/g, '').trim();

    // ── 1. BUSCAR OU CONSULTAR STATUS DA NF-E (PUT /fd/add/{chave}) ──────────
    if (action === 'buscar' || action === 'status') {
      if (!chave || chave.length !== 44) {
        return res.status(400).json({ success: false, error: 'Chave de acesso inválida (deve ter 44 dígitos).' });
      }

      const mdResp = await fetch(`${MEUDANFE_BASE}/fd/add/${chave}`, {
        method: 'PUT',
        headers: mdHeaders
      });

      const data = await mdResp.json().catch(() => ({}));
      return res.status(mdResp.status).json(data);
    }

    // ── 2. BAIXAR DANFE EM PDF (GET /fd/get/da/{chave}) ─────────────────────
    if (action === 'danfe') {
      if (!chave || chave.length !== 44) {
        return res.status(400).json({ success: false, error: 'Chave de acesso inválida.' });
      }

      const mdResp = await fetch(`${MEUDANFE_BASE}/fd/get/da/${chave}`, {
        method: 'GET',
        headers: mdHeaders
      });

      const data = await mdResp.json().catch(() => ({}));
      return res.status(mdResp.status).json(data);
    }

    // ── 3. BAIXAR XML DA NF-E (GET /fd/get/xml/{chave}) ──────────────────────
    if (action === 'xml') {
      if (!chave || chave.length !== 44) {
        return res.status(400).json({ success: false, error: 'Chave de acesso inválida.' });
      }

      const mdResp = await fetch(`${MEUDANFE_BASE}/fd/get/xml/${chave}`, {
        method: 'GET',
        headers: mdHeaders
      });

      const data = await mdResp.json().catch(() => ({}));
      return res.status(mdResp.status).json(data);
    }

    // ── 4. LISTAR NF-ES CONSULTADAS (GET /fd/my/NFE) ─────────────────────────
    if (action === 'minhas_nfes' || action === 'listar') {
      const isSuperAdmin = auth.isSystem || (auth.user && auth.user.perfil === 'superadmin');
      if (!isSuperAdmin) {
        return res.status(403).json({
          success: false,
          error: 'A listagem global de NF-es é restrita a administradores do sistema.'
        });
      }

      const after = (req.query.after || (req.body && req.body.after) || '').toString().trim();
      const qs = after ? `?after=${encodeURIComponent(after)}` : '';

      const mdResp = await fetch(`${MEUDANFE_BASE}/fd/my/NFE${qs}`, {
        method: 'GET',
        headers: mdHeaders
      });

      const data = await mdResp.json().catch(() => ({}));
      return res.status(mdResp.status).json(data);
    }

    // ── 5. ENVIAR XML SEFAZ (PUT /fd/add/sefaz-xml) ──────────────────────────
    if (action === 'sefaz_xml') {
      const xmlString = req.body && (req.body.xml || req.body);
      if (!xmlString || typeof xmlString !== 'string') {
        return res.status(400).json({ success: false, error: 'Conteúdo XML não fornecido.' });
      }

      const mdResp = await fetch(`${MEUDANFE_BASE}/fd/add/sefaz-xml`, {
        method: 'PUT',
        headers: { ...mdHeaders, 'Content-Type': 'text/plain' },
        body: xmlString
      });

      const data = await mdResp.json().catch(() => ({}));
      return res.status(mdResp.status).json(data);
    }

    return res.status(400).json({ success: false, error: `Ação NF-e '${action}' não reconhecida.` });
  } catch (err) {
    console.error('Erro no proxy serverless de NF-e:', err);
    return res.status(500).json({ success: false, error: 'Erro ao comunicar com serviço de NF-e.', detail: err.message });
  }
}
