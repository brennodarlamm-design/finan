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
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_5gVqFJ3NRyvK@ep-solitary-river-ach3x8za-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require';
const TARGET_PHONE = process.env.TARGET_PHONE || '5595991363678';

const sql = neon(DATABASE_URL);

// ── ESTADO DO WHATSAPP ───────────────────────────────────────────────────────
let sock = null;
let currentQR = null;
let qrDataUrl = null;
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
let lastConnectedAt = null;

// Formata número de telefone brasileiro (DDI + DDD + Número)
function formatWhatsAppJid(phone) {
  let cleaned = String(phone).replace(/\D/g, '');
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  return `${cleaned}@s.whatsapp.net`;
}

// ── PERSISTÊNCIA DO AUTH NO NEON POSTGRESQL ─────────────────────────────────
async function syncAuthFromPostgres(authDir) {
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
  try {
    if (!fs.existsSync(authDir)) return;
    const files = fs.readdirSync(authDir);
    for (const file of files) {
      const filePath = path.join(authDir, file);
      if (fs.statSync(filePath).isFile()) {
        const content = fs.readFileSync(filePath, 'utf8');
        await sql`
          INSERT INTO whatsapp_auth (key, value, updated_at)
          VALUES (${file}, ${content}, CURRENT_TIMESTAMP)
          ON CONFLICT (key) DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = CURRENT_TIMESTAMP;
        `;
      }
    }
  } catch (err) {
    console.warn('⚠️ [WhatsApp] Falha ao salvar sessão no Neon:', err.message);
  }
}

// ── INICIALIZAÇÃO DO BAILEYS ─────────────────────────────────────────────────
async function startWhatsApp() {
  try {
    const authDir = path.resolve('auth_info_baileys');
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    // Restaura as chaves do PostgreSQL se existirem
    await syncAuthFromPostgres(authDir);

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: ['Angelim Construtora ERP', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', async () => {
      await saveCreds();
      await saveAuthToPostgres(authDir);
    });

    // Observa e sincroniza automaticamente qualquer arquivo de chave criado pelo Baileys
    let syncTimer = null;
    try {
      fs.watch(authDir, () => {
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
          saveAuthToPostgres(authDir).catch(() => {});
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
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`🔌 [WhatsApp] Conexão fechada (${statusCode}). Reconectar: ${shouldReconnect}`);
        connectionStatus = 'disconnected';
        currentQR = null;
        qrDataUrl = null;

        if (shouldReconnect) {
          setTimeout(startWhatsApp, 3000);
        } else {
          console.log('⚠️ [WhatsApp] Desconectado permanentemente. Limpando sessão no Neon...');
          try {
            await sql`DELETE FROM whatsapp_auth;`;
            fs.rmSync(authDir, { recursive: true, force: true });
          } catch {}
          setTimeout(startWhatsApp, 3000);
        }
      } else if (connection === 'open') {
        console.log('✅ [WhatsApp] Conectado e pronto para envio 24/7!');
        connectionStatus = 'connected';
        currentQR = null;
        qrDataUrl = null;
        lastConnectedAt = new Date().toISOString();
        await saveAuthToPostgres(authDir);
      }
    });
  } catch (err) {
    console.error('❌ Erro ao iniciar WhatsApp Baileys:', err);
    setTimeout(startWhatsApp, 5000);
  }
}

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
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">🟢 100% CONECTADO</div>
          <h1>WhatsApp Conectado!</h1>
          <p>O robô 24/7 da <strong>Angelim Construtora</strong> está ativo e pronto para enviar mensagens e relatórios automáticos.</p>
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
      </style>
    </head>
    <body>
      <div>
        <h2>⏳ Iniciando motor WhatsApp...</h2>
        <p style="color:#94a3b8;">Gerando novo QR Code em instantes...</p>
      </div>
    </body>
    </html>
  `);
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

    const jid = formatWhatsAppJid(destPhone);
    const sent = await sock.sendMessage(jid, { text: message });

    console.log(`📤 [WhatsApp] Mensagem enviada com sucesso para ${destPhone}!`);
    return res.json({ success: true, messageId: sent.key.id, to: destPhone });
  } catch (err) {
    console.error('❌ Erro ao enviar mensagem:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 4. Teste de Conexão com o Neon
app.get('/test-neon', async (req, res) => {
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

// ── ROBÔ CRON MATINAL (08:00 AM) ─────────────────────────────────────────────
async function executarResumoMatinal() {
  console.log('⏰ [Cron] Executando verificação matinal no Neon PostgreSQL...');
  try {
    const hoje = new Date().toISOString().split('T')[0];

    // Busca contas a pagar vencendo hoje ou já vencidas
    const boletos = await sql`
      SELECT l.*, o.nome as obra_nome
      FROM lancamentos l
      LEFT JOIN obras o ON l.obra_id = o.id
      WHERE l.tipo = 'despesa'
        AND l.status = 'a_pagar'
        AND (l.data_vencimento <= ${hoje} OR l.data <= ${hoje})
      ORDER BY l.data_vencimento ASC;
    `;

    if (!boletos || boletos.length === 0) {
      console.log('✅ [Cron] Nenhuma conta vencendo hoje.');
      return;
    }

    let totalValor = 0;
    let listaTexto = '';

    boletos.forEach((b, idx) => {
      const v = Number(b.valor) || 0;
      totalValor += v;
      const vFmt = v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      listaTexto += `\n${idx + 1}. *${b.fornecedor_beneficiario || b.descricao}*\n   💵 Valor: ${vFmt}\n   📅 Vencimento: ${b.data_vencimento || b.data}\n`;
      if (b.codigo_barras) {
        listaTexto += `   🔢 Código: \`${b.codigo_barras}\`\n`;
      }
    });

    const totalFmt = totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const msg = `🏢 *ANGELIM CONSTRUTORA — RESUMO MATINAL*\n📅 *Data:* ${new Date().toLocaleDateString('pt-BR')}\n\n⚠️ *Atenção:* Você possui *${boletos.length} conta(s)* com vencimento hoje ou pendentes:\n${listaTexto}\n💰 *Total a pagar:* ${totalFmt}\n\n_Mensagem automática gerada pelo ERP Angelim na nuvem._`;

    if (connectionStatus === 'connected' && sock) {
      const jid = formatWhatsAppJid(TARGET_PHONE);
      await sock.sendMessage(jid, { text: msg });
      console.log(`✅ [Cron] Resumo matinal de R$ ${totalValor} enviado com sucesso para ${TARGET_PHONE}!`);
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
