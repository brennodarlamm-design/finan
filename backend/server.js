// backend/server.js — Servidor 24/7 para Render (WhatsApp Baileys + Neon PostgreSQL + Robô Cron)

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

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

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
    console.error('   Valor recebido:', rawDbUrl);
  }
}

const TARGET_PHONE = process.env.TARGET_PHONE || '5595991363678';
const AUTH_DIR = path.resolve('auth_info_baileys');

// ── ESTADO DO WHATSAPP ───────────────────────────────────────────────────────
let sock = null;
let currentQR = null;
let qrDataUrl = null;
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
let lastConnectedAt = null;
let isStartingWhatsApp = false;

// Resolve o JID canônico oficial no WhatsApp (trata variação de 8 e 9 dígitos no Brasil)
async function resolveWhatsAppJid(phone) {
  let cleaned = String(phone).replace(/\D/g, '');
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }

  // 1. Se o destino for o próprio número conectado, usa o próprio JID do socket
  if (sock && sock.user && sock.user.id) {
    const myNum = sock.user.id.split(':')[0].replace(/\D/g, '');
    const myClean = myNum.startsWith('55') ? myNum : '55' + myNum;
    if (cleaned === myClean || cleaned.slice(-8) === myClean.slice(-8)) {
      const myJid = sock.user.id.includes('@') ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : `${myClean}@s.whatsapp.net`;
      console.log(`🎯 [WhatsApp] Destino é o próprio aparelho conectado (${myJid})`);
      return myJid;
    }
  }

  // 2. Consulta a API oficial onWhatsApp do Baileys para validar se o número existe na Meta
  try {
    if (sock && sock.onWhatsApp) {
      // Tenta o número exatamente como veio
      const res1 = await sock.onWhatsApp(cleaned);
      if (res1 && res1.length > 0 && res1[0].exists) {
        console.log(`🎯 [WhatsApp] JID validado na Meta: ${res1[0].jid}`);
        return res1[0].jid;
      }

      // Se for número BR com 13 dígitos (55 + DDD + 9 dígitos), tenta sem o 9º dígito (12 dígitos)
      if (cleaned.length === 13 && cleaned.startsWith('55')) {
        const ddd = cleaned.substring(2, 4);
        const rest = cleaned.substring(5);
        const altPhone = `55${ddd}${rest}`;
        const res2 = await sock.onWhatsApp(altPhone);
        if (res2 && res2.length > 0 && res2[0].exists) {
          console.log(`🎯 [WhatsApp] JID canônico validado sem o 9º dígito: ${res2[0].jid}`);
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
          console.log(`🎯 [WhatsApp] JID canônico validado com o 9º dígito: ${res3[0].jid}`);
          return res3[0].jid;
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ [WhatsApp] Aviso ao consultar onWhatsApp:', err.message);
  }

  // Fallback padrão se não conseguir consultar
  return `${cleaned}@s.whatsapp.net`;
}

// ── PERSISTÊNCIA DO AUTH NO NEON POSTGRESQL ─────────────────────────────────
async function syncAuthFromPostgres(authDir) {
  if (!sql) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS whatsapp_auth (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    const rows = await sql`SELECT key, value FROM whatsapp_auth;`;
    if (rows && rows.length > 0) {
      console.log(`📥 [WhatsApp] Restaurando ${rows.length} chave(s) de sessão do Neon PostgreSQL...`);
      for (const row of rows) {
        const filePath = path.join(authDir, row.key);
        fs.writeFileSync(filePath, row.value, 'utf8');
      }
    }
  } catch (err) {
    console.warn('⚠️ [WhatsApp] Falha ao ler sessão do Neon:', err.message);
  }
}

async function saveAuthToPostgres(authDir) {
  if (!sql) return;
  try {
    if (!fs.existsSync(authDir)) return;
    const files = fs.readdirSync(authDir);
    for (const file of files) {
      const filePath = path.join(authDir, file);
      try {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const content = fs.readFileSync(filePath, 'utf8');
          await sql`
            INSERT INTO whatsapp_auth (key, value, updated_at)
            VALUES (${file}, ${content}, CURRENT_TIMESTAMP)
            ON CONFLICT (key) DO UPDATE SET
              value = EXCLUDED.value,
              updated_at = CURRENT_TIMESTAMP;
          `;
        }
      } catch (fileErr) {
        if (fileErr.code === 'ENOENT') {
          try {
            await sql`DELETE FROM whatsapp_auth WHERE key = ${file};`;
          } catch {}
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ [WhatsApp] Falha ao salvar sessão no Neon:', err.message);
  }
}

// ── LIMPEZA E RESET DE SESSÃO ───────────────────────────────────────────────
async function resetWhatsAppSession(reason = 'Reset manual ou sessão inválida') {
  console.log(`🧹 [WhatsApp] Limpando sessão (${reason})...`);
  connectionStatus = 'disconnected';
  currentQR = null;
  qrDataUrl = null;

  if (sock) {
    try {
      sock.ev?.removeAllListeners();
      sock.ws?.close();
      sock.end?.();
    } catch {}
    sock = null;
  }

  // 1. Limpa banco de dados Neon
  if (sql) {
    try {
      await sql`DELETE FROM whatsapp_auth;`;
      console.log('✅ [WhatsApp] Tabela whatsapp_auth limpa no Neon.');
    } catch (e) {
      console.warn('⚠️ [WhatsApp] Erro ao limpar whatsapp_auth no Neon:', e.message);
    }
  }

  // 2. Limpa pasta local de credenciais
  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      console.log('✅ [WhatsApp] Pasta auth_info_baileys removida localmente.');
    }
  } catch (e) {
    console.warn('⚠️ [WhatsApp] Erro ao deletar pasta auth local:', e.message);
  }

  // 3. Reinicia o WhatsApp para gerar novo QR Code
  setTimeout(() => {
    startWhatsApp(true);
  }, 1000);
}

// ── INICIALIZAÇÃO DO BAILEYS ─────────────────────────────────────────────────
async function startWhatsApp(forceClean = false) {
  if (isStartingWhatsApp) return;
  isStartingWhatsApp = true;

  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    if (!forceClean) {
      // Restaura as chaves do PostgreSQL se existirem
      await syncAuthFromPostgres(AUTH_DIR);
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: ['Angelim Construtora ERP', 'Chrome', '1.0.0'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000
    });

    sock.ev.on('creds.update', async () => {
      await saveCreds();
      await saveAuthToPostgres(AUTH_DIR);
    });

    // Observa e sincroniza automaticamente qualquer arquivo de chave criado pelo Baileys
    let syncTimer = null;
    try {
      fs.watch(AUTH_DIR, () => {
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
          saveAuthToPostgres(AUTH_DIR).catch(() => {});
        }, 500);
      });
    } catch {}

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQR = qr;
        qrDataUrl = await QRCode.toDataURL(qr);
        connectionStatus = 'qr_ready';
        console.log('⚡ [WhatsApp] Novo QR Code gerado! Acesse /qr no navegador.');
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const errMessage = lastDisconnect?.error?.message || '';
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;

        console.log(`🔌 [WhatsApp] Conexão fechada (${statusCode} - ${errMessage}). Reconectar: ${shouldReconnect}`);
        connectionStatus = 'disconnected';
        currentQR = null;
        qrDataUrl = null;

        if (shouldReconnect) {
          setTimeout(() => {
            isStartingWhatsApp = false;
            startWhatsApp();
          }, 3000);
        } else {
          console.log('⚠️ [WhatsApp] Sessão desconectada ou revogada pelo WhatsApp. Resetando credenciais...');
          isStartingWhatsApp = false;
          await resetWhatsAppSession('Desconectado permanentemente (401 / Logged Out)');
        }
      } else if (connection === 'open') {
        console.log('✅ [WhatsApp] Conectado e pronto para envio 24/7!');
        connectionStatus = 'connected';
        currentQR = null;
        qrDataUrl = null;
        lastConnectedAt = new Date().toISOString();
        await saveAuthToPostgres(AUTH_DIR);
      }
    });
  } catch (err) {
    console.error('❌ Erro ao iniciar WhatsApp Baileys:', err.message);
    if (err.message && (err.message.includes('Unsupported state') || err.message.includes('authenticate data') || err.message.includes('Bad MAC'))) {
      console.warn('🚨 Detectadas chaves de criptografia inválidas no startup. Resetando sessão...');
      isStartingWhatsApp = false;
      await resetWhatsAppSession('Chaves inválidas no startup');
      return;
    }
    setTimeout(() => {
      isStartingWhatsApp = false;
      startWhatsApp();
    }, 5000);
  } finally {
    isStartingWhatsApp = false;
  }
}

// ── PROTEÇÃO GLOBAL CONTRA CRASHES POR CRIPTOGRAFIA / NOISE HANDSHAKE ────────
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
    console.warn('🚨 [Auto-Recovery] Falha crítica de decifração/sessão do WhatsApp detectada.');
    console.warn('🔄 Resetando automaticamente sessão corrompida do Neon e gerando novo QR Code...');
    try {
      await resetWhatsAppSession('Recuperação automática de erro de decifração Noise/AES-GCM');
    } catch (resetErr) {
      console.error('❌ Falha no reset automático:', resetErr);
    }
  } else {
    console.error('Stack:', err?.stack);
  }
});

process.on('unhandledRejection', (reason) => {
  console.warn('⚠️ [UnhandledRejection]', reason);
});

startWhatsApp();

// ── ROTAS DA API ─────────────────────────────────────────────────────────────

// 1. Status Geral
app.get('/', (req, res) => {
  res.json({
    name: 'Angelim Construtora — Backend 24/7 (Render)',
    status: 'online',
    whatsapp: {
      status: connectionStatus,
      last_connected: lastConnectedAt,
      qr_available: !!qrDataUrl
    },
    database: 'Neon PostgreSQL (sa-east-1)',
    uptime_seconds: process.uptime()
  });
});

app.get('/status', (req, res) => {
  res.json({
    connected: connectionStatus === 'connected',
    status: connectionStatus,
    qr_available: !!qrDataUrl,
    last_connected: lastConnectedAt
  });
});

// 2. Página Web Visual do QR Code
app.get('/qr', (req, res) => {
  if (connectionStatus === 'connected') {
    return res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>WhatsApp Conectado — Angelim Construtora</title>
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
          <p>O robô 24/7 da <strong>Angelim Construtora</strong> está ativo e pronto para enviar mensagens e relatórios automáticos.</p>
          <form action="/reset-auth" method="POST" onsubmit="return confirm('Deseja realmente desconectar e resetar a sessão?');">
            <button type="submit" class="btn-danger">🔌 Desconectar e Trocar de Aparelho</button>
          </form>
        </div>
      </body>
      </html>
    `);
  }

  if (qrDataUrl) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="15">
        <title>Escanear QR Code — Angelim WhatsApp</title>
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
          <p><span class="pulse"></span> Abra o WhatsApp no celular &gt; <strong>Aparelhos conectados</strong> &gt; <strong>Conectar um aparelho</strong> e aponte para a imagem abaixo:</p>
          <div class="qr-img">
            <img src="${qrDataUrl}" alt="QR Code WhatsApp" style="width: 260px; height: 260px; display: block;" />
          </div>
          <p style="font-size: 0.75rem; color: #64748b;">A página atualiza automaticamente a cada 15 segundos.</p>
          <form action="/reset-auth" method="POST">
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
        <h2>⏳ Iniciando motor WhatsApp...</h2>
        <p style="color:#94a3b8;">Gerando novo QR Code em instantes...</p>
        <form action="/reset-auth" method="POST">
          <button type="submit" class="btn-subtle">⚠️ Forçar limpeza completa da sessão</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// 2.1 Rota de Reset Manual da Sessão
app.all('/reset-auth', async (req, res) => {
  console.log('🔄 [API] Requisição de reset de autenticação recebida.');
  await resetWhatsAppSession('Solicitado via API /reset-auth');
  
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="refresh" content="3; url=/qr">
        <title>Sessão Resetada</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
        </style>
      </head>
      <body>
        <div>
          <h2>✅ Sessão resetada com sucesso!</h2>
          <p style="color:#94a3b8;">Redirecionando para a tela do QR Code em 3 segundos...</p>
          <a href="/qr" style="color:#38bdf8;">Clique aqui se não for redirecionado</a>
        </div>
      </body>
      </html>
    `);
  }

  return res.json({
    success: true,
    message: 'Sessão do WhatsApp limpa no Neon PostgreSQL e no servidor. Novo QR Code será gerado.',
    hint: 'Acesse /qr para escanear o novo QR Code.'
  });
});

// 3. Disparo de Mensagem em Segundo Plano
app.post('/send-message', async (req, res) => {
  try {
    const { phone, message } = req.body;
    const destPhone = phone || TARGET_PHONE;

    if (!message) {
      return res.status(400).json({ error: 'Campo "message" é obrigatório.' });
    }

    if (connectionStatus !== 'connected' || !sock) {
      return res.status(503).json({
        error: 'WhatsApp ainda não está conectado no servidor.',
        status: connectionStatus,
        hint: 'Acesse /qr para escanear o QR Code.'
      });
    }

    const jid = await resolveWhatsAppJid(destPhone);
    console.log(`📤 [WhatsApp] Disparando para JID canônico: ${jid} (número solicitado: ${destPhone})`);
    const sent = await sock.sendMessage(jid, { text: message });

    console.log(`✅ [WhatsApp] Mensagem entregue com sucesso para ${jid} (ID: ${sent.key.id})!`);
    return res.json({ success: true, messageId: sent.key.id, to: destPhone, canonicalJid: jid });
  } catch (err) {
    console.error('❌ Erro ao enviar mensagem:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 4. Teste de Conexão com o Neon
app.get('/test-neon', async (req, res) => {
  if (!sql) {
    return res.status(503).json({ success: false, error: 'DATABASE_URL não configurada ou inválida no servidor.' });
  }
  try {
    const result = await sql`SELECT version(), CURRENT_TIMESTAMP as agora;`;
    const [obras, lancamentos] = await Promise.all([
      sql`SELECT COUNT(*) FROM obras;`,
      sql`SELECT COUNT(*) FROM lancamentos;`
    ]);

    return res.json({
      success: true,
      postgres_version: result[0]?.version,
      agora: result[0]?.agora,
      total_obras: Number(obras[0]?.count || 0),
      total_lancamentos: Number(lancamentos[0]?.count || 0)
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

// ── ROBÔ CRON MATINAL (08:00 AM) ─────────────────────────────────────────────
async function executarResumoMatinal() {
  if (!sql) {
    console.warn('⚠️ [Cron] DATABASE_URL não disponível. Resumo matinal ignorado.');
    return;
  }
  console.log('⏰ [Cron] Executando verificação matinal no Neon PostgreSQL...');
  try {
    const hoje = new Date().toISOString().split('T')[0];

    // Busca contas a pagar vencendo hoje ou já vencidas (com casting de data robusto)
    const boletos = await sql`
      SELECT l.*, o.nome as obra_nome
      FROM lancamentos l
      LEFT JOIN obras o ON l.obra_id = o.id
      WHERE l.tipo = 'despesa'
        AND l.status = 'a_pagar'
        AND (DATE(COALESCE(l.data_vencimento, l.data)) <= ${hoje}::date)
      ORDER BY COALESCE(l.data_vencimento, l.data) ASC;
    `;

    if (!boletos || boletos.length === 0) {
      console.log('✅ [Cron] Nenhuma conta vencendo hoje ou pendente.');
      return;
    }

    let totalValor = 0;
    let listaTexto = '';

    boletos.forEach((b, idx) => {
      const v = Number(b.valor) || 0;
      totalValor += v;
      const vFmt = v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const dtVencFmt = formatDateBR(b.data_vencimento || b.data);
      listaTexto += `\n${idx + 1}. *${b.fornecedor_beneficiario || b.descricao}*\n   💵 Valor: ${vFmt}\n   📅 Vencimento: ${dtVencFmt}\n`;
      if (b.codigo_barras) {
        listaTexto += `   🔢 Código: \`${b.codigo_barras}\`\n`;
      }
    });

    const totalFmt = totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const msg = `🏢 *ANGELIM CONSTRUTORA — RESUMO MATINAL*\n📅 *Data:* ${new Date().toLocaleDateString('pt-BR')}\n\n⚠️ *Atenção:* Você possui *${boletos.length} conta(s)* com vencimento hoje ou pendentes:\n${listaTexto}\n💰 *Total a pagar:* ${totalFmt}\n\n_Mensagem automática gerada pelo ERP Angelim na nuvem._`;

    if (connectionStatus === 'connected' && sock) {
      const jid = await resolveWhatsAppJid(TARGET_PHONE);
      await sock.sendMessage(jid, { text: msg });
      console.log(`✅ [Cron] Resumo matinal de R$ ${totalValor} enviado com sucesso para ${jid}!`);
    } else {
      console.log('⚠️ [Cron] WhatsApp não conectado no momento do disparo matinal.');
    }
  } catch (err) {
    console.error('❌ [Cron] Erro ao executar resumo matinal:', err);
  }
}

// Agendado para todo dia às 08:00 AM (Horário de Boa Vista / UTC-4 -> 12:00 UTC)
cron.schedule('0 12 * * *', () => {
  executarResumoMatinal();
});

// Rota manual para disparar o resumo matinal imediatamente
app.post('/cron/daily-summary', async (req, res) => {
  await executarResumoMatinal();
  return res.json({ success: true, message: 'Rotina matinal executada!' });
});

// ── INICIALIZAÇÃO DO SERVIDOR ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 SERVIDOR ANGELIM 24/7 INICIADO NA PORTA ${PORT}`);
  console.log(`👉 Status: http://localhost:${PORT}/status`);
  console.log(`👉 QR Code Web: http://localhost:${PORT}/qr`);
  console.log(`👉 Teste Neon: http://localhost:${PORT}/test-neon`);
  console.log(`======================================================\n`);
});
