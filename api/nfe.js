// api/nfe.js — Proxy Serverless Seguro para Consulta de NF-e via API MeuDanfe & Certificados A1

import { resolveAuthAndTenant } from './_auth.js';
import { canAccessModule, permissionError } from './_permissions.js';
import { checkRateLimit, getClientIp } from './_ratelimit.js';
import { createRuntimeSql } from './_database.js';
import { createTenantSql } from './_tenant-sql.js';
import { syncTenantDFe, getDFeStatus, listarDFeDocumentos, getDFeDocumentoXml } from './_sefaz-dfe.js';
import certificadoHandler from './_certificado.js';

const ALLOWED_ORIGINS = [
  'https://fingo.api.br',
  'https://www.fingo.api.br',
  'http://localhost:3000',
  'http://localhost:3333',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3333',
  'http://127.0.0.1:5000'
];

function setCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin);
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
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
    const ip = getClientIp(req);
    const rl = await checkRateLimit(`cnpj:ip:${ip}`, 20, 60000);
    if (!rl.allowed) return res.status(429).json({ error: 'Muitas consultas de CNPJ. Aguarde um momento antes de tentar novamente.' });

    const cnpj = req.query?.cnpj || (req.body && req.body.cnpj);
    if (!cnpj) return res.status(400).json({ error: 'CNPJ não informado' });
    const cnpjLimpo = String(cnpj).replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return res.status(400).json({ error: 'CNPJ inválido' });
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'FinObra/1.0' },
        signal: AbortSignal.timeout(7000)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return res.status(response.status).json(data);
      return res.status(200).json(data);
    } catch (err) {
      console.warn('[CNPJ] Falha ao consultar BrasilAPI:', err?.name || 'Error', err?.message || err);
      return res.status(502).json({ error: 'Não foi possível consultar o CNPJ no momento.' });
    }
  }

  // ── 0.1. CONSULTA DE CEP (BrasilAPI com Fallback ViaCEP) ─────────────────
  const isCep = req.query?.action === 'cep' || (req.query?.cep && !req.query?.action) || (req.body && (req.body.action === 'cep' || req.body.cep));
  if (isCep) {
    const ip = getClientIp(req);
    const rl = await checkRateLimit(`cep:ip:${ip}`, 30, 60000);
    if (!rl.allowed) return res.status(429).json({ success: false, error: 'Muitas consultas de CEP. Aguarde um momento antes de tentar novamente.' });

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
      console.warn('[CEP] Falha nos provedores de CEP:', errCep?.name || 'Error', errCep?.message || errCep);
      return res.status(502).json({ success: false, error: 'Falha ao consultar serviço de CEP.' });
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

  const action = req.query.action || (req.body && req.body.action);

  // ── AÇÕES DO MONITOR DF-E NATIVO SEFAZ (MULTI-TENANT) ─────────────────────
  if (action && action.startsWith('dfe_')) {
    let baseSql;
    try {
      baseSql = createRuntimeSql();
    } catch (err) {
      console.error('[NFe DF-e] Database indisponível:', err.message);
      return res.status(500).json({ success: false, error: 'Banco de dados indisponível no servidor.' });
    }
    const sql = createTenantSql(baseSql, { tenantId: auth.tenantId });

    if (action === 'dfe_status') {
      const statusData = await getDFeStatus(sql, auth.tenantId);
      return res.status(200).json(statusData);
    }

    if (action === 'dfe_listar') {
      const docsData = await listarDFeDocumentos(sql, auth.tenantId, {
        tipo: req.query.tipo,
        busca: req.query.busca,
        limit: req.query.limit,
        offset: req.query.offset
      });
      return res.status(200).json(docsData);
    }

    if (action === 'dfe_sync') {
      if (!canAccessModule(auth, 'notas', 'write')) {
        return res.status(403).json(permissionError('MODULE_WRITE_FORBIDDEN', 'notas'));
      }
      const syncResult = await syncTenantDFe(sql, auth.tenantId, {
        codUf: req.body?.codUf || req.query?.codUf,
        force: req.body?.force === true
      });
      return res.status(200).json(syncResult);
    }

    if (action === 'dfe_xml') {
      const idOrChave = req.query.id || req.query.chave || req.body?.id || req.body?.chave;
      if (!idOrChave) {
        return res.status(400).json({ success: false, error: 'Identificador ou chave do documento não informado.' });
      }
      const xmlResult = await getDFeDocumentoXml(sql, auth.tenantId, idOrChave);
      if (!xmlResult.success) {
        return res.status(404).json(xmlResult);
      }
      if (req.query.download === 'true') {
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${xmlResult.documento.chave || 'documento'}.xml"`);
        return res.status(200).send(xmlResult.documento.xml);
      }
      return res.status(200).json(xmlResult);
    }

    return res.status(400).json({ success: false, error: `Ação DF-e '${action}' não reconhecida.` });
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
    const chave = (req.query.chave || (req.body && req.body.chave) || '').toString().replace(/\D/g, '').trim();

    // ── 1. BUSCAR OU CONSULTAR STATUS DA NF-E (PUT /fd/add/{chave}) ──────────
    if (action === 'buscar' || action === 'status') {
      if (!chave || chave.length !== 44) {
        return res.status(400).json({ success: false, error: 'Chave de acesso inválida (deve ter 44 dígitos).' });
      }

      const mdResp = await fetch(`${MEUDANFE_BASE}/fd/add/${chave}`, {
        method: 'PUT',
        headers: mdHeaders,
        signal: AbortSignal.timeout(15000)
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
        headers: mdHeaders,
        signal: AbortSignal.timeout(15000)
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
        headers: mdHeaders,
        signal: AbortSignal.timeout(15000)
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
        headers: mdHeaders,
        signal: AbortSignal.timeout(15000)
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
        body: xmlString,
        signal: AbortSignal.timeout(20000)
      });

      const data = await mdResp.json().catch(() => ({}));
      return res.status(mdResp.status).json(data);
    }

    return res.status(400).json({ success: false, error: `Ação NF-e '${action}' não reconhecida.` });
  } catch (err) {
    console.error('Erro no proxy serverless de NF-e:', err);
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return res.status(502).json({
      success: false,
      error: timedOut ? 'O serviço de NF-e demorou além do limite. Tente novamente.' : 'Erro ao comunicar com serviço de NF-e.'
    });
  }
}
