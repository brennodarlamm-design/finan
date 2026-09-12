// api/nfe.js — Proxy Serverless Seguro para Consulta de NF-e via API MeuDanfe & Certificados A1

import { resolveAuthAndTenant } from './_auth.js';
import { canAccessModule, permissionError } from './_permissions.js';
import certificadoHandler from './_certificado.js';

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
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || /^https:\/\/finan-as(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin);
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, apikey, x-tenant-id');
}

const MEUDANFE_BASE = 'https://api.meudanfe.com.br/v2';

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ── DESPACHO PARA GESTÃO DE CERTIFICADO DIGITAL A1 ───────────────────────
  const isCertificado = req.query?.sub === 'certificado' ||
    req.query?.scope === 'certificado' ||
    String(req.url || '').includes('certificado') ||
    (req.query?.action && ['upload', 'remover'].includes(req.query.action)) ||
    (req.query?.action === 'status' && !req.query?.chave && !req.body?.chave);

  if (isCertificado) {
    return certificadoHandler(req, res);
  }

  // ── 0. CONSULTA PÚBLICA DE CNPJ (BrasilAPI) ──────────────────────────────
  const isCnpj = req.query?.action === 'cnpj' || req.query?.cnpj || (req.body && req.body.action === 'cnpj');
  if (isCnpj) {
    const cnpj = req.query?.cnpj || (req.body && req.body.cnpj);
    if (!cnpj) return res.status(400).json({ error: 'CNPJ não informado' });
    const cnpjLimpo = String(cnpj).replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return res.status(400).json({ error: 'CNPJ inválido' });
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'FinObra/1.0' }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return res.status(response.status).json(data);
      return res.status(200).json(data);
    } catch (err) {
      return res.status(502).json({ error: 'Erro ao consultar Receita Federal', detail: err.message });
    }
  }

  // ── 0.1. CONSULTA DE CEP (BrasilAPI com Fallback ViaCEP) ─────────────────
  const isCep = req.query?.action === 'cep' || (req.query?.cep && !req.query?.action) || (req.body && (req.body.action === 'cep' || req.body.cep));
  if (isCep) {
    const rawCep = req.query?.cep || (req.body && req.body.cep);
    if (!rawCep) return res.status(400).json({ success: false, error: 'CEP não informado.' });
    const cepLimpo = String(rawCep).replace(/\D/g, '');
    if (cepLimpo.length !== 8) {
      return res.status(400).json({ success: false, error: 'CEP inválido (deve conter 8 dígitos numéricos).' });
    }

    try {
      let data = null;
      // 1. Consulta primária via BrasilAPI
      try {
        const brResp = await fetch(`https://brasilapi.com.br/api/cep/v1/${cepLimpo}`, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'FinObra/1.0' },
          signal: AbortSignal.timeout(5000)
        });
        if (brResp.ok) {
          const brJson = await brResp.json().catch(() => null);
          if (brJson && !brJson.errors) {
            data = {
              success: true,
              cep: brJson.cep || cepLimpo,
              logradouro: brJson.street || '',
              bairro: brJson.neighborhood || '',
              cidade: brJson.city || '',
              uf: brJson.state || '',
              provedor: 'brasilapi'
            };
          }
        }
      } catch {}

      // 2. Fallback resiliente via ViaCEP
      if (!data) {
        const viaResp = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'FinObra/1.0' },
          signal: AbortSignal.timeout(5000)
        });
        if (viaResp.ok) {
          const viaJson = await viaResp.json().catch(() => null);
          if (viaJson && !viaJson.erro) {
            data = {
              success: true,
              cep: (viaJson.cep || cepLimpo).replace(/\D/g, ''),
              logradouro: viaJson.logradouro || '',
              bairro: viaJson.bairro || '',
              cidade: viaJson.localidade || '',
              uf: viaJson.uf || '',
              ibge: viaJson.ibge || '',
              provedor: 'viacep'
            };
          }
        }
      }

      if (data) {
        return res.status(200).json(data);
      } else {
        return res.status(404).json({ success: false, error: 'CEP não encontrado nas bases de dados.' });
      }
    } catch (errCep) {
      return res.status(502).json({ success: false, error: 'Falha ao consultar serviço de CEP.', detail: errCep.message });
    }
  }

  // 1. Exige autenticação rigorosa
  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({
      success: false,
      error: auth.error || 'Acesso não autorizado para consulta de NF-e.'
    });
  }
  if (!canAccessModule(auth,'notas','read')) return res.status(403).json(permissionError('MODULE_READ_FORBIDDEN','notas'));

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
