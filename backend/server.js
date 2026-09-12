// backend/server.js — Servidor 24/7 para Render (WhatsApp Baileys Multi-Tenant + Neon PostgreSQL + Robô Cron)

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import QRCode from 'qrcode';
import { neon } from '@neondatabase/serverless';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();

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

app.use(cors({
  origin: (origin, callback) => {
    const isFinobraVercel = /^https:\/\/finan-as(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin || '');
    if (!origin || ALLOWED_ORIGINS.includes(origin) || isFinobraVercel) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// Middleware de autenticação interna para proteger rotas críticas.
// Segredos de API são aceitos SOMENTE em headers — nunca em query string.
function getInternalSecret() {
  return (process.env.API_SECRET || process.env.VERCEL_API_SECRET || '').trim();
}

function hasInternalApiAuth(req) {
  const secret = getInternalSecret();
  if (!secret) return false;
  const authHeader = String(req.headers.authorization || req.headers.Authorization || '');
  if (authHeader.startsWith('Bearer ') && authHeader.substring(7).trim() === secret) return true;
  const apiKey = String(req.headers['x-api-key'] || req.headers['apikey'] || '');
  return Boolean(apiKey && apiKey.trim() === secret);
}

function requireAuth(req, res, next) {
  if (!getInternalSecret()) {
    console.error('❌ [Segurança] API_SECRET não configurado no backend. Bloqueando requisição por segurança.');
    return res.status(500).json({ error: 'Configuração de segurança pendente no servidor.' });
  }
  if (hasInternalApiAuth(req)) return next();
  return res.status(401).json({
    error: 'Acesso não autorizado ao servidor WhatsApp. Forneça autenticação interna em header.'
  });
}

const QR_COOKIE = 'finobra_qr_access';
function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}
function signQrAccess(tenantId, ttlSeconds = 900) {
  const secret = getInternalSecret();
  const payload = `${cleanTenantId(tenantId)}.${Math.floor(Date.now() / 1000) + ttlSeconds}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function verifyQrAccess(req, tenantId) {
  const secret = getInternalSecret();
  const token = parseCookies(req)[QR_COOKIE] || '';
  const [tenant, expRaw, sig] = String(token).split('.');
  const exp = Number(expRaw);
  if (!secret || !tenant || !exp || !sig || tenant !== cleanTenantId(tenantId) || exp < Math.floor(Date.now() / 1000)) return false;
  const payload = `${tenant}.${exp}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function setQrAccessCookie(res, tenantId) {
  const token = signQrAccess(tenantId);
  res.setHeader('Set-Cookie', `${QR_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=900; Secure`);
}
function requireQrOrApiAuth(req, res, next) {
  const tenantId = extractTenantFromReq(req);
  if (hasInternalApiAuth(req) || verifyQrAccess(req, tenantId)) return next();
  return res.status(401).json({ error: 'Sessão de administração do WhatsApp expirada ou inválida.' });
}

const PORT = process.env.PORT || 3333;
let rawDbUrl = process.env.DATABASE_URL || '';
rawDbUrl = rawDbUrl.trim().replace(/^["']|["']$/g, '');

let sql = null;
if (!rawDbUrl) {
  console.warn('⚠️ [Aviso] DATABASE_URL não configurada no ambiente. Configure no .env ou no painel do Render.');
} else {
  try {
    sql = neon(rawDbUrl);
    console.log('✅ Cliente Neon PostgreSQL inicializado.');
  } catch (err) {
    console.error('❌ [Erro Neon] String de conexão inválida ou incompleta:', err.message);
  }
}

const TARGET_PHONE = (process.env.TARGET_PHONE || '').trim();
const TARGET_TENANT_ID = (process.env.TARGET_TENANT_ID || process.env.DEFAULT_TENANT_ID || 'public').trim();

// ── GERENCIAMENTO MULTI-TENANT DE SESSÕES WHATSAPP ───────────────────────────
const sessions = new Map();

function cleanTenantId(raw) {
  const clean = String(raw || TARGET_TENANT_ID || 'public').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return clean || 'public';
}

function getTenantSession(tenantId) {
  const tId = cleanTenantId(tenantId);
  if (!sessions.has(tId)) {
    const authDir = path.resolve('sessions', tId, 'auth_info_baileys');
    sessions.set(tId, {
      tenantId: tId,
      sock: null,
      currentQR: null,
      qrDataUrl: null,
      connectionStatus: 'disconnected', // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
      lastConnectedAt: null,
      isStarting: false,
      authDir,
      syncTimer: null
    });
  }
  return sessions.get(tId);
}

function getConnectedWhatsAppNumber(session) {
  if (!session?.sock?.user?.id) return null;
  const raw = session.sock.user.id.split(':')[0].replace(/\D/g, '');
  return raw || null;
}

// Resolve o JID canônico oficial no WhatsApp para a sessão do tenant
async function resolveWhatsAppJid(session, phone) {
  let cleaned = String(phone).replace(/\D/g, '');
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }

  // 1. Se o destino for o próprio número conectado, usa o próprio JID do socket
  const sock = session?.sock;
  if (sock && sock.user && sock.user.id) {
    const myNum = sock.user.id.split(':')[0].replace(/\D/g, '');
    const myClean = myNum.startsWith('55') ? myNum : '55' + myNum;
    if (cleaned === myClean || cleaned.slice(-8) === myClean.slice(-8)) {
      const myJid = sock.user.id.includes('@') ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : `${myClean}@s.whatsapp.net`;
      console.log(`🎯 [WhatsApp:${session.tenantId}] Destino é o próprio aparelho conectado (${myJid})`);
      return myJid;
    }
  }

  // 2. Consulta a API oficial onWhatsApp do Baileys para validar se o número existe na Meta
  try {
    if (sock && sock.onWhatsApp) {
      const res1 = await sock.onWhatsApp(cleaned);
      if (res1 && res1.length > 0 && res1[0].exists) {
        console.log(`🎯 [WhatsApp:${session.tenantId}] JID validado na Meta: ${res1[0].jid}`);
        return res1[0].jid;
      }

      // Se for número BR com 13 dígitos (55 + DDD + 9 dígitos), tenta sem o 9º dígito (12 dígitos)
      if (cleaned.length === 13 && cleaned.startsWith('55')) {
        const ddd = cleaned.substring(2, 4);
        const rest = cleaned.substring(5);
        const altPhone = `55${ddd}${rest}`;
        const res2 = await sock.onWhatsApp(altPhone);
        if (res2 && res2.length > 0 && res2[0].exists) {
          console.log(`🎯 [WhatsApp:${session.tenantId}] JID validado sem o 9º dígito: ${res2[0].jid}`);
          return res2[0].jid;
        }
      }

      // Se for número BR com 12 dígitos (55 + DDD + 8 dígitos), tenta adicionando o 9
      if (cleaned.length === 12 && cleaned.startsWith('55')) {
        const ddd = cleaned.substring(2, 4);
        const rest = cleaned.substring(4);
        const altPhone = `55${ddd}9${rest}`;
        const res3 = await sock.onWhatsApp(altPhone);
        if (res3 && res3.length > 0 && res3[0].exists) {
          console.log(`🎯 [WhatsApp:${session.tenantId}] JID validado com o 9º dígito: ${res3[0].jid}`);
          return res3[0].jid;
        }
      }
    }
  } catch (err) {
    console.warn(`⚠️ [WhatsApp:${session.tenantId}] Aviso ao consultar onWhatsApp:`, err.message);
  }

  return `${cleaned}@s.whatsapp.net`;
}

// ── PERSISTÊNCIA DO AUTH NO NEON POSTGRESQL POR TENANT ───────────────────────
async function syncAuthFromPostgres(session) {
  if (!sql) return;
  try {
    if (!fs.existsSync(session.authDir)) {
      fs.mkdirSync(session.authDir, { recursive: true });
    }

    const rows = await sql`
      SELECT key, value FROM tenant_whatsapp_auth WHERE tenant_id = ${session.tenantId};
    `;

    if (rows && rows.length > 0) {
      console.log(`📥 [WhatsApp:${session.tenantId}] Restaurando ${rows.length} chave(s) de sessão do Neon...`);
      for (const row of rows) {
        const filePath = path.join(session.authDir, row.key);
        fs.writeFileSync(filePath, row.value, 'utf8');
      }
    } else if (session.tenantId === TARGET_TENANT_ID || session.tenantId === 'public') {
      // Migração retroativa de sessões legadas sem tenant
      try {
        const legacy = await sql`SELECT key, value FROM whatsapp_auth;`;
        if (legacy && legacy.length > 0) {
          console.log(`📥 [WhatsApp:${session.tenantId}] Migrando ${legacy.length} chave(s) da tabela legada...`);
          for (const row of legacy) {
            const filePath = path.join(session.authDir, row.key);
            fs.writeFileSync(filePath, row.value, 'utf8');
            await sql`
              INSERT INTO tenant_whatsapp_auth (tenant_id, key, value, updated_at)
              VALUES (${session.tenantId}, ${row.key}, ${row.value}, CURRENT_TIMESTAMP)
              ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value;
            `;
          }
        }
      } catch {}
    }
  } catch (err) {
    console.warn(`⚠️ [WhatsApp:${session.tenantId}] Falha ao ler sessão do Neon:`, err.message);
  }
}

async function saveAuthToPostgres(session) {
  if (!sql) return;
  try {
    if (!fs.existsSync(session.authDir)) return;
    const files = fs.readdirSync(session.authDir);
    for (const file of files) {
      const filePath = path.join(session.authDir, file);
      try {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const content = fs.readFileSync(filePath, 'utf8');
          await sql`
            INSERT INTO tenant_whatsapp_auth (tenant_id, key, value, updated_at)
            VALUES (${session.tenantId}, ${file}, ${content}, CURRENT_TIMESTAMP)
            ON CONFLICT (tenant_id, key) DO UPDATE SET
              value = EXCLUDED.value,
              updated_at = CURRENT_TIMESTAMP;
          `;
        }
      } catch (fileErr) {
        if (fileErr.code === 'ENOENT') {
          try {
            await sql`DELETE FROM tenant_whatsapp_auth WHERE tenant_id = ${session.tenantId} AND key = ${file};`;
          } catch {}
        }
      }
    }
  } catch (err) {
    console.warn(`⚠️ [WhatsApp:${session.tenantId}] Falha ao salvar sessão no Neon:`, err.message);
  }
}

// ── LIMPEZA E RESET DE SESSÃO POR TENANT ────────────────────────────────────
async function resetWhatsAppSession(tenantId, reason = 'Reset manual ou sessão inválida') {
  const session = getTenantSession(tenantId);
  console.log(`🧹 [WhatsApp:${session.tenantId}] Limpando sessão (${reason})...`);
  session.connectionStatus = 'disconnected';
  session.currentQR = null;
  session.qrDataUrl = null;

  if (session.sock) {
    try {
      session.sock.ev?.removeAllListeners();
      session.sock.ws?.close();
      session.sock.end?.();
    } catch {}
    session.sock = null;
  }

  // 1. Limpa tabela tenant_whatsapp_auth no Neon
  if (sql) {
    try {
      await sql`DELETE FROM tenant_whatsapp_auth WHERE tenant_id = ${session.tenantId};`;
      console.log(`✅ [WhatsApp:${session.tenantId}] Credenciais removidas do Neon.`);
    } catch (e) {
      console.warn(`⚠️ [WhatsApp:${session.tenantId}] Erro ao limpar credenciais no Neon:`, e.message);
    }
  }

  // 2. Limpa pasta local de credenciais do tenant
  try {
    if (fs.existsSync(session.authDir)) {
      fs.rmSync(session.authDir, { recursive: true, force: true });
      console.log(`✅ [WhatsApp:${session.tenantId}] Pasta local removida.`);
    }
  } catch (e) {
    console.warn(`⚠️ [WhatsApp:${session.tenantId}] Erro ao deletar pasta auth:`, e.message);
  }

  // 3. Reinicia para gerar novo QR Code
  setTimeout(() => {
    startWhatsApp(session.tenantId, true);
  }, 1000);
}

// ── INICIALIZAÇÃO DO BAILEYS POR TENANT ───────────────────────────────────────
async function startWhatsApp(tenantId, forceClean = false) {
  const session = getTenantSession(tenantId);
  if (session.isStarting) return;
  session.isStarting = true;

  try {
    if (!fs.existsSync(session.authDir)) {
      fs.mkdirSync(session.authDir, { recursive: true });
    }

    if (!forceClean) {
      await syncAuthFromPostgres(session);
    }

    const { state, saveCreds } = await useMultiFileAuthState(session.authDir);
    const { version } = await fetchLatestBaileysVersion();

    session.sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: ['FinObra ERP', 'Chrome', '1.0.0'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000
    });

    session.sock.ev.on('creds.update', async () => {
      await saveCreds();
      await saveAuthToPostgres(session);
    });

    // Observa e sincroniza automaticamente qualquer arquivo de chave criado pelo Baileys
    try {
      fs.watch(session.authDir, () => {
        if (session.syncTimer) clearTimeout(session.syncTimer);
        session.syncTimer = setTimeout(() => {
          saveAuthToPostgres(session).catch(() => {});
        }, 500);
      });
    } catch {}

    session.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        session.currentQR = qr;
        session.qrDataUrl = await QRCode.toDataURL(qr);
        session.connectionStatus = 'qr_ready';
        console.log(`⚡ [WhatsApp:${session.tenantId}] Novo QR Code gerado!`);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const errMessage = lastDisconnect?.error?.message || '';
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;

        console.log(`🔌 [WhatsApp:${session.tenantId}] Conexão fechada (${statusCode} - ${errMessage}). Reconectar: ${shouldReconnect}`);
        session.connectionStatus = 'disconnected';
        session.currentQR = null;
        session.qrDataUrl = null;

        if (shouldReconnect) {
          setTimeout(() => {
            session.isStarting = false;
            startWhatsApp(session.tenantId);
          }, 3000);
        } else {
          console.log(`⚠️ [WhatsApp:${session.tenantId}] Sessão desconectada ou revogada. Resetando credenciais...`);
          session.isStarting = false;
          await resetWhatsAppSession(session.tenantId, 'Desconectado permanentemente (401 / Logged Out)');
        }
      } else if (connection === 'open') {
        console.log(`✅ [WhatsApp:${session.tenantId}] Conectado e pronto para envio 24/7!`);
        session.connectionStatus = 'connected';
        session.currentQR = null;
        session.qrDataUrl = null;
        session.lastConnectedAt = new Date().toISOString();
        await saveAuthToPostgres(session);
      }
    });
  } catch (err) {
    console.error(`❌ Erro ao iniciar WhatsApp Baileys [${session.tenantId}]:`, err.message);
    if (err.message && (err.message.includes('Unsupported state') || err.message.includes('authenticate data') || err.message.includes('Bad MAC'))) {
      console.warn(`🚨 Chaves inválidas no startup [${session.tenantId}]. Resetando sessão...`);
      session.isStarting = false;
      await resetWhatsAppSession(session.tenantId, 'Chaves inválidas no startup');
      return;
    }
    setTimeout(() => {
      session.isStarting = false;
      startWhatsApp(session.tenantId);
    }, 5000);
  } finally {
    session.isStarting = false;
  }
}

// ── INICIALIZA SESSÕES EXISTENTES NO STARTUP ────────────────────────────────
async function bootstrapAllSessions() {
  // 1. Inicia sessão padrão / configurada
  startWhatsApp(TARGET_TENANT_ID);

  // 2. Se houver outras empresas com credenciais salvas no Neon, inicia suas sessões
  if (sql) {
    try {
      const distinct = await sql`SELECT DISTINCT tenant_id FROM tenant_whatsapp_auth WHERE tenant_id != ${TARGET_TENANT_ID};`;
      if (distinct && distinct.length > 0) {
        for (const row of distinct) {
          if (row.tenant_id) {
            console.log(`🚀 [Startup] Inicializando sessão do tenant ${row.tenant_id}...`);
            startWhatsApp(row.tenant_id);
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ [Startup] Falha ao verificar sessões de outros tenants:', e.message);
    }
  }
}

bootstrapAllSessions();

// ── PROTEÇÃO GLOBAL CONTRA CRASHES POR NOISE / CRIPTOGRAFIA ─────────────────
process.on('uncaughtException', async (err) => {
  const msg = err?.message || String(err);
  console.error('⚠️ [UncaughtException]', msg);

  if (
    msg.includes('Unsupported state') ||
    msg.includes('unable to authenticate data') ||
    msg.includes('Bad MAC') ||
    msg.includes('noise-handler') ||
    msg.includes('Decipheriv')
  ) {
    console.warn('🚨 [Auto-Recovery] Falha de decifração/sessão do WhatsApp detectada.');
    for (const [tId, sess] of sessions.entries()) {
      if (sess.connectionStatus !== 'connected') {
        try {
          await resetWhatsAppSession(tId, 'Recuperação automática de erro de decifração Noise/AES-GCM');
        } catch {}
      }
    }
  } else {
    console.error('Stack:', err?.stack);
    setTimeout(() => process.exit(1), 100).unref?.();
  }
});

process.on('unhandledRejection', (reason) => {
  console.warn('⚠️ [UnhandledRejection]', reason);
});

// ── ROTAS DA API ─────────────────────────────────────────────────────────────

function extractTenantFromReq(req) {
  const t = req.headers['x-tenant-id'] || req.query?.tenant_id || req.body?.tenantId || req.body?.tenant_id || TARGET_TENANT_ID || 'public';
  return cleanTenantId(t);
}

// 1. Status Geral
app.get('/', requireAuth, (req, res) => {
  const summary = Array.from(sessions.values()).map(s => ({
    tenant_id: s.tenantId,
    status: s.connectionStatus,
    connected: s.connectionStatus === 'connected',
    last_connected: s.lastConnectedAt
  }));

  res.json({
    name: 'FinObra — Backend 24/7 Multi-Tenant (Render)',
    status: 'online',
    total_sessoes: sessions.size,
    sessoes: summary,
    database: 'Neon PostgreSQL (sa-east-1)',
    uptime_seconds: process.uptime()
  });
});

app.get('/status', requireAuth, (req, res) => {
  const tenantId = extractTenantFromReq(req);
  const session = getTenantSession(tenantId);
  res.json({
    tenant_id: session.tenantId,
    connected: session.connectionStatus === 'connected',
    status: session.connectionStatus,
    qr_available: !!session.qrDataUrl,
    last_connected: session.lastConnectedAt
  });
});

// 1.1 Health Check Monitor
app.get('/health', async (req, res) => {
  let dbOk = false;
  if (sql) {
    try { await sql`SELECT 1;`; dbOk = true; } catch {}
  }
  const healthy = Boolean(sql && dbOk);
  return res.status(healthy ? 200 : 503).json({ status: healthy ? 'healthy' : 'degraded' });
});

// 1.2 Sessão Estruturada do WhatsApp por Tenant
app.get('/whatsapp-session', requireAuth, (req, res) => {
  const tenantId = extractTenantFromReq(req);
  const session = getTenantSession(tenantId);

  // Se a sessão estiver desconectada e não estiver gerando QR, inicia a geração
  if (session.connectionStatus === 'disconnected' && !session.isStarting) {
    startWhatsApp(session.tenantId);
  }

  const connectedNumber = getConnectedWhatsAppNumber(session);
  res.json({
    success: true,
    tenantId: session.tenantId,
    status: session.connectionStatus,
    connected: session.connectionStatus === 'connected',
    connectedNumber,
    qrDataUrl: session.connectionStatus === 'qr_ready' ? session.qrDataUrl : null,
    lastConnectedAt: session.lastConnectedAt
  });
});

// 2. Página Web Visual do QR Code com Suporte Multi-Tenant e Sem Token em Query String (C-05/H-15)
app.all('/qr', (req, res) => {
  const secret = (process.env.API_SECRET || process.env.VERCEL_API_SECRET || '').trim();
  const providedToken = String(req.body?.token || req.headers?.authorization?.replace(/^Bearer\s+/i, '') || req.headers?.['x-api-key'] || '').trim();
  const tenantId = extractTenantFromReq(req);
  const cookieAuthorized = verifyQrAccess(req, tenantId);
  const secretAuthorized = Boolean(secret && providedToken === secret);

  if (secret && !secretAuthorized && !cookieAuthorized) {
    return res.status(401).send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Acesso Restrito — QR Code WhatsApp</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 32px; border-radius: 16px; border: 1px solid #334155; text-align: center; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          input { width: 100%; box-sizing: border-box; padding: 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: white; margin: 16px 0; font-family: monospace; font-size: 0.9rem; }
          button { background: #10b981; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; width: 100%; font-size: 0.9rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>🔒 Acesso Restrito</h2>
          <p style="color:#94a3b8;font-size:0.9rem;">Informe a chave de segurança para visualizar o QR Code do WhatsApp:</p>
          <form method="POST" action="/qr">
            <input type="hidden" name="tenant_id" value="${tenantId}" />
            <input type="password" name="token" placeholder="Insira o API_SECRET" required autofocus />
            <button type="submit">Desbloquear QR Code</button>
          </form>
        </div>
      </body>
      </html>
    `);
  }

  if (secretAuthorized) setQrAccessCookie(res, tenantId);

  const session = getTenantSession(tenantId);
  if (session.connectionStatus === 'disconnected' && !session.isStarting) {
    startWhatsApp(session.tenantId);
  }

  const hiddenTokenInput = `<input type="hidden" name="tenant_id" value="${tenantId}" />`;

  if (session.connectionStatus === 'connected') {
    const num = getConnectedWhatsAppNumber(session);
    return res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>WhatsApp Conectado — FinObra</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 32px; border-radius: 16px; border: 1px solid #334155; text-align: center; max-width: 420px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          .badge { background: #10b981; color: #022c22; font-weight: 700; padding: 6px 14px; border-radius: 999px; display: inline-block; margin-bottom: 16px; }
          h1 { margin: 0 0 8px; font-size: 1.5rem; }
          p { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; }
          .btn-danger { display: inline-block; margin-top: 20px; background: #dc2626; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; text-decoration: none; font-size: 0.85rem; transition: background 0.2s; }
          .btn-danger:hover { background: #b91c1c; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">🟢 100% CONECTADO</div>
          <h1>WhatsApp Conectado!</h1>
          <p>Empresa / Tenant: <strong>${session.tenantId}</strong></p>
          <p>Número conectado: <strong>${num ? '+' + num : 'Conectado'}</strong></p>
          <form action="/reset-auth" method="POST" onsubmit="return confirm('Deseja realmente desconectar e trocar o aparelho desta empresa?');">
            ${hiddenTokenInput}
            <button type="submit" class="btn-danger">🔌 Desconectar e Trocar de Aparelho</button>
          </form>
        </div>
      </body>
      </html>
    `);
  }

  if (session.qrDataUrl) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="15">
        <title>Escanear QR Code — FinObra WhatsApp</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 32px; border-radius: 16px; border: 1px solid #334155; text-align: center; max-width: 420px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          .qr-img { background: #fff; padding: 12px; border-radius: 12px; margin: 20px 0; display: inline-block; }
          h1 { margin: 0 0 8px; font-size: 1.4rem; }
          p { color: #94a3b8; font-size: 0.85rem; line-height: 1.4; margin: 0; }
          .pulse { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; margin-right: 6px; }
          .btn-subtle { display: inline-block; margin-top: 15px; color: #94a3b8; font-size: 0.75rem; text-decoration: underline; background: transparent; border: none; cursor: pointer; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>📲 Conectar WhatsApp</h1>
          <p style="color:#38bdf8;font-weight:600;margin-bottom:8px;">Empresa: ${session.tenantId}</p>
          <p><span class="pulse"></span> Abra o WhatsApp no celular &gt; <strong>Aparelhos conectados</strong> &gt; <strong>Conectar um aparelho</strong> e aponte para a imagem abaixo:</p>
          <div class="qr-img">
            <img src="${session.qrDataUrl}" alt="QR Code WhatsApp" style="width: 260px; height: 260px; display: block;" />
          </div>
          <p style="font-size: 0.75rem; color: #64748b;">A página atualiza automaticamente a cada 15 segundos.</p>
          <form action="/reset-auth" method="POST">
            ${hiddenTokenInput}
            <button type="submit" class="btn-subtle">🔄 Limpar sessão e forçar novo QR Code</button>
          </form>
        </div>
      </body>
      </html>
    `);
  }

  return res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="refresh" content="4">
      <title>Gerando QR Code...</title>
      <style>
        body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
        .btn-subtle { display: inline-block; margin-top: 20px; color: #ef4444; font-size: 0.8rem; text-decoration: underline; background: transparent; border: none; cursor: pointer; }
      </style>
    </head>
    <body>
      <div>
        <h2>⏳ Iniciando motor WhatsApp (${session.tenantId})...</h2>
        <p style="color:#94a3b8;">Gerando novo QR Code em instantes...</p>
        <form action="/reset-auth" method="POST">
          ${hiddenTokenInput}
          <button type="submit" class="btn-subtle">⚠️ Forçar limpeza completa da sessão</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// 2.1 Rota de Reset Manual da Sessão
app.all('/reset-auth', requireQrOrApiAuth, async (req, res) => {
  const tenantId = extractTenantFromReq(req);
  const reason = req.body?.reason || req.query?.reason || 'Solicitado via API /reset-auth';
  console.log(`🔄 [API] Requisição de reset de autenticação recebida para tenant: ${tenantId}`);
  await resetWhatsAppSession(tenantId, reason);

  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="refresh" content="3; url=/qr?tenant_id=${encodeURIComponent(tenantId)}">
        <title>Sessão Resetada</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
        </style>
      </head>
      <body>
        <div>
          <h2>✅ Sessão resetada com sucesso para ${tenantId}!</h2>
          <p style="color:#94a3b8;">Redirecionando para a tela do QR Code em 3 segundos...</p>
          <a href="/qr?tenant_id=${encodeURIComponent(tenantId)}" style="color:#38bdf8;">Clique aqui se não for redirecionado</a>
        </div>
      </body>
      </html>
    `);
  }

  return res.json({
    success: true,
    tenantId,
    message: `Sessão do WhatsApp do tenant ${tenantId} limpa no Neon PostgreSQL e no servidor. Novo QR Code será gerado.`,
    hint: 'Abra novamente a tela protegida de QR Code para conectar o aparelho.'
  });
});

// 3. Disparo de Mensagem em Segundo Plano com Isolamento por Tenant
app.post('/send-message', requireAuth, async (req, res) => {
  try {
    const tenantId = extractTenantFromReq(req);
    const session = getTenantSession(tenantId);

    const { phone, message, text, base64, mimeType, fileName, caption } = req.body;
    const destPhone = String(phone || '').replace(/\D/g, '');
    const msgText = message || text || caption || '';

    if (!destPhone || destPhone.length < 10 || destPhone.length > 15) {
      return res.status(400).json({ error: 'Campo \"phone\" é obrigatório e deve conter um número válido.' });
    }

    if (!msgText && !base64) {
      return res.status(400).json({ error: 'Campo "message" ou "base64" é obrigatório.' });
    }

    if (session.connectionStatus !== 'connected' || !session.sock) {
      return res.status(503).json({
        error: `WhatsApp da empresa (${session.tenantId}) ainda não está conectado no servidor.`,
        tenantId: session.tenantId,
        status: session.connectionStatus,
        hint: `Acesse /qr?tenant_id=${session.tenantId} para escanear o QR Code.`
      });
    }

    const jid = await resolveWhatsAppJid(session, destPhone);
    let sent;

    if (base64) {
      const cleanB64 = String(base64).replace(/^data:[^;]+;base64,/, '');
      const buf = Buffer.from(cleanB64, 'base64');
      const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
      if (buf.length === 0 || buf.length > MAX_MEDIA_BYTES) {
        return res.status(413).json({ error: 'Arquivo inválido ou acima do limite de 8 MB.' });
      }
      const mime = String(mimeType || 'application/pdf').split(';')[0].trim().toLowerCase();
      const forbiddenMime = /^(?:text\/html|image\/svg\+xml|application\/xhtml\+xml|text\/javascript|application\/javascript)$/i;
      if (forbiddenMime.test(mime)) {
        return res.status(400).json({ error: 'Tipo de mídia não permitido.' });
      }

      if (/^image\/(?:jpeg|png|webp)$/i.test(mime)) {
        console.log(`📤 [WhatsApp:${session.tenantId}] Enviando imagem para ${jid}...`);
        sent = await session.sock.sendMessage(jid, {
          image: buf,
          caption: msgText || undefined
        });
      } else {
        console.log(`📤 [WhatsApp:${session.tenantId}] Enviando documento (${mime}) para ${jid}...`);
        sent = await session.sock.sendMessage(jid, {
          document: buf,
          mimetype: mime,
          fileName: fileName || 'documento.pdf',
          caption: msgText || undefined
        });
      }
    } else {
      console.log(`📤 [WhatsApp:${session.tenantId}] Disparando texto para JID canônico: ${jid} (número: ${destPhone})`);
      sent = await session.sock.sendMessage(jid, { text: msgText });
    }

    console.log(`✅ [WhatsApp:${session.tenantId}] Mensagem entregue com sucesso para ${jid} (ID: ${sent?.key?.id})!`);
    return res.json({ success: true, tenantId: session.tenantId, messageId: sent?.key?.id, to: destPhone, canonicalJid: jid });
  } catch (err) {
    console.error('❌ Erro ao enviar mensagem:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 4. Teste de Conexão com o Neon
app.get('/test-neon', requireAuth, async (req, res) => {
  if (!sql) {
    return res.status(503).json({ success: false, error: 'DATABASE_URL não configurada ou inválida no servidor.' });
  }
  try {
    const result = await sql`SELECT version(), CURRENT_TIMESTAMP as agora;`;
    const [obras, lancamentos, whatsappAuth] = await Promise.all([
      sql`SELECT COUNT(*) FROM obras;`,
      sql`SELECT COUNT(*) FROM lancamentos;`,
      sql`SELECT COUNT(*) FROM tenant_whatsapp_auth;`
    ]);

    return res.json({
      success: true,
      postgres_version: result[0]?.version,
      agora: result[0]?.agora,
      total_obras: Number(obras[0]?.count || 0),
      total_lancamentos: Number(lancamentos[0]?.count || 0),
      total_whatsapp_keys: Number(whatsappAuth[0]?.count || 0)
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

function formatDateBR(d) {
  if (!d) return '—';
  if (d instanceof Date) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${day}/${m}/${y}`;
  }
  let s = String(d).trim();
  if (s.includes('T')) s = s.split('T')[0];
  const parts = s.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return s;
}

// ── ROBÔ CRON MATINAL (08:00 AM) MULTI-TENANT ───────────────────────────────
async function executarResumoMatinal(explicitTenantId = null) {
  if (!sql) {
    console.warn('⚠️ [Cron] DATABASE_URL não disponível. Resumo matinal ignorado.');
    return;
  }

  // Compatibilidade com verificação do tenant default em modo legado
  if (!explicitTenantId && (!TARGET_TENANT_ID || !TARGET_PHONE)) {
    if (!TARGET_TENANT_ID || !TARGET_PHONE) {
      console.log('ℹ️ [Cron] Configurações padrão de tenant/telefone avaliadas para o ciclo.');
    }
  }

  let tenantsToProcess = [];
  if (explicitTenantId) {
    const rows = await sql`
      SELECT id, COALESCE(nome_fantasia, razao_social, id) AS nome, telefone
      FROM tenants WHERE id = ${explicitTenantId};
    `;
    tenantsToProcess = rows || [];
  } else {
    // Itera por todos os tenants ativos no sistema
    const rows = await sql`
      SELECT id, COALESCE(nome_fantasia, razao_social, id) AS nome, telefone
      FROM tenants WHERE status != 'bloqueado';
    `;
    tenantsToProcess = rows || [];
  }

  if (!tenantsToProcess.length) {
    console.log('⏰ [Cron] Nenhum tenant ativo encontrado para resumo matinal.');
    return;
  }

  const hoje = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Boa_Vista', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());

  for (const t of tenantsToProcess) {
    const tId = t.id;
    const session = getTenantSession(tId);
    const destPhone = t.telefone || TARGET_PHONE;

    if (!destPhone) {
      console.log(`ℹ️ [Cron:${tId}] Nenhum telefone cadastrado para o tenant.`);
      continue;
    }

    try {
      const boletos = await sql`
        SELECT l.*, o.nome as obra_nome
        FROM lancamentos l
        LEFT JOIN obras o
          ON l.obra_id = o.id
         AND l.tenant_id = o.tenant_id
        WHERE l.tipo = 'despesa'
          AND l.tenant_id = ${tId} -- l.tenant_id = ${TARGET_TENANT_ID}
          AND l.status IN ('a_pagar', 'pendente', 'em_atraso')
          AND (DATE(COALESCE(l.data_vencimento, l.data)) <= ${hoje}::date)
        ORDER BY COALESCE(l.data_vencimento, l.data) ASC;
      `;

      if (!boletos || boletos.length === 0) {
        console.log(`✅ [Cron:${tId}] Nenhuma conta pendente vencendo hoje.`);
        continue;
      }

      let totalValor = 0;
      let listaTexto = '';
      boletos.forEach((b, idx) => {
        const v = Number(b.valor) || 0;
        totalValor += v;
        const vFmt = v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const dtVencFmt = formatDateBR(b.data_vencimento || b.data);
        listaTexto += `\n${idx + 1}. *${b.fornecedor_beneficiario || b.descricao || 'Conta'}*\n   💵 Valor: ${vFmt}\n   📅 Vencimento: ${dtVencFmt}\n`;
        if (b.codigo_barras) listaTexto += `   🔢 Código: \`${b.codigo_barras}\`\n`;
      });

      const totalFmt = totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const dataLocal = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Boa_Vista' });
      const msg = `🏢 *${t.nome.toUpperCase()} — RESUMO MATINAL*\n📅 *Data:* ${dataLocal}\n\n⚠️ *Atenção:* Você possui *${boletos.length} conta(s)* com vencimento hoje ou pendentes:\n${listaTexto}\n💰 *Total a pagar:* ${totalFmt}\n\n_Mensagem automática gerada pelo FinObra._`;

      if (session.connectionStatus === 'connected' && session.sock) {
        const jid = await resolveWhatsAppJid(session, destPhone);
        await session.sock.sendMessage(jid, { text: msg });
        console.log(`✅ [Cron:${tId}] Resumo matinal enviado para ${destPhone}.`);
      } else {
        console.log(`⚠️ [Cron:${tId}] WhatsApp desconectado no momento do disparo matinal.`);
      }
    } catch (tErr) {
      console.error(`❌ [Cron:${tId}] Erro ao processar tenant:`, tErr.message);
    }
  }
}

// Agendado para 08:00 no fuso America/Boa_Vista (12:00 UTC; sem horário de verão)
cron.schedule('0 12 * * *', () => {
  executarResumoMatinal();
});

// Rota manual para disparar o resumo matinal imediatamente
app.post('/cron/daily-summary', requireAuth, async (req, res) => {
  const tenantId = req.body?.tenantId || req.query?.tenant_id || null;
  await executarResumoMatinal(tenantId);
  return res.json({ success: true, message: 'Rotina matinal executada!' });
});

// ── KEEP-ALIVE SELF-PING (EVITA SLEEP NO RENDER FREE TIER) ─────────────────
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || 'https://finan-wf12.onrender.com';
cron.schedule('*/10 * * * *', async () => {
  try {
    const pingRes = await fetch(`${RENDER_EXTERNAL_URL}/health`);
    console.log(`💓 [Keep-Alive] Ping no servidor (${pingRes.status})`);
  } catch (pingErr) {
    console.warn('⚠️ [Keep-Alive] Aviso no auto-ping:', pingErr.message);
  }
});

// ── INICIALIZAÇÃO DO SERVIDOR ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 SERVIDOR FINOBRA 24/7 MULTI-TENANT NA PORTA ${PORT}`);
  console.log(`👉 Status: http://localhost:${PORT}/status`);
  console.log(`👉 QR Code Web: http://localhost:${PORT}/qr`);
  console.log(`👉 Teste Neon: http://localhost:${PORT}/test-neon`);
  console.log(`======================================================\n`);
});
