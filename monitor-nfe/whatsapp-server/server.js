// ==============================================================================
//  ANGELIM CONSTRUTORA — Servidor Local de WhatsApp (Evolution Engine)
// ==============================================================================

const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
const PORT = process.env.PORT || 3333;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let currentQR = null;
let isConnected = false;
let userInfo = null;

function getBrowserExecutablePath() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.CHROME_PATH
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return undefined;
}

const browserPath = getBrowserExecutablePath();
process.on('unhandledRejection', (reason) => {
  if (String(reason).includes('Execution context was destroyed') || String(reason).includes('Target closed')) {
    console.log('Aguardando sincronização do WhatsApp Web...');
    return;
  }
  console.warn('Aviso interno do WhatsApp:', reason?.message || reason);
});

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: path.join(__dirname, '.wwebjs_auth')
  }),
  puppeteer: {
    executablePath: browserPath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  }
});

client.on('qr', async (qr) => {
  try {
    currentQR = await qrcode.toDataURL(qr);
    isConnected = false;
    console.log('\n⚡ NOVO QR CODE GERADO COM SUCESSO!');
    console.log('👉 Acesse http://localhost:' + PORT + ' no seu navegador para escanear.\n');
  } catch (err) {
    console.error('Erro ao gerar imagem do QR Code:', err);
  }
});

client.on('ready', () => {
  isConnected = true;
  currentQR = null;
  userInfo = client.info;
  console.log('\n======================================================');
  console.log('✅ WHATSAPP DA ANGELIM CONSTRUTORA CONECTADO COM SUCESSO!');
  console.log(`👤 Usuário: ${client.info?.pushname || client.info?.wid?.user || 'Angelim Construtora'}`);
  console.log(`🚀 API Pronta para envio em: http://localhost:${PORT}/send-message`);
  console.log('======================================================\n');
});

client.on('authenticated', () => {
  console.log('Autenticação realizada com sucesso! Carregando conversas...');
});

client.on('auth_failure', (msg) => {
  console.error('Falha de autenticação:', msg);
});

client.on('disconnected', (reason) => {
  isConnected = false;
  currentQR = null;
  userInfo = null;
  console.log('Desconectado do WhatsApp:', reason);
  setTimeout(startWhatsApp, 3000);
});

let isInitializing = false;
async function startWhatsApp() {
  if (isInitializing) return;
  isInitializing = true;
  try {
    console.log('Conectando ao WhatsApp Web...');
    await client.initialize();
  } catch (err) {
    isInitializing = false;
    if (err.message && err.message.includes('Execution context was destroyed')) {
      console.log('Sincronizando WhatsApp... Reconectando em 2 segundos.');
      setTimeout(startWhatsApp, 2000);
    } else {
      console.log('Tentando reconectar WhatsApp em 3 segundos...');
      setTimeout(startWhatsApp, 3000);
    }
  }
}

startWhatsApp();

// ── ROTAS DA API ─────────────────────────────────────────────────────────────

// Status em JSON
app.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    user: userInfo ? { name: userInfo.pushname, phone: userInfo.wid?.user } : null,
    qrAvailable: !!currentQR
  });
});

// Envio de Mensagem de Texto
app.post('/send-message', async (req, res) => {
  try {
    const rawNumber = req.body.number || req.body.phone || req.body.to;
    const message = req.body.message || req.body.text;

    if (!rawNumber || !message) {
      return res.status(400).json({ success: false, error: 'Campos "number" e "message" são obrigatórios.' });
    }

    if (!isConnected) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp ainda não conectado. Acesse http://localhost:3333 e escaneie o QR Code.'
      });
    }

    let numLimpo = String(rawNumber).replace(/\D/g, '');
    if (!numLimpo.startsWith('55') && numLimpo.length <= 11) {
      numLimpo = '55' + numLimpo;
    }

    // Resolve o JID/LID exato registrado no WhatsApp
    let targetChatId = null;

    try {
      const numberDetails = await client.getNumberId(numLimpo);
      if (numberDetails && numberDetails._serialized) {
        targetChatId = numberDetails._serialized;
      }
    } catch (e) {
      console.warn('Aviso ao consultar getNumberId:', e.message);
    }

    // Se não encontrou e for celular brasileiro com 13 dígitos (55 + DDD + 9XXXX-XXXX), tenta formato com 12 dígitos
    if (!targetChatId && numLimpo.startsWith('55') && numLimpo.length === 13) {
      const sem9 = numLimpo.slice(0, 4) + numLimpo.slice(5);
      try {
        const numberDetailsSem9 = await client.getNumberId(sem9);
        if (numberDetailsSem9 && numberDetailsSem9._serialized) {
          targetChatId = numberDetailsSem9._serialized;
        }
      } catch (e) {}
    }

    // Se for formato com 12 dígitos, tenta com 13 dígitos
    if (!targetChatId && numLimpo.startsWith('55') && numLimpo.length === 12) {
      const com9 = numLimpo.slice(0, 4) + '9' + numLimpo.slice(4);
      try {
        const numberDetailsCom9 = await client.getNumberId(com9);
        if (numberDetailsCom9 && numberDetailsCom9._serialized) {
          targetChatId = numberDetailsCom9._serialized;
        }
      } catch (e) {}
    }

    if (!targetChatId) {
      targetChatId = `${numLimpo}@c.us`;
    }

    console.log(`[${new Date().toLocaleTimeString()}] Enviando para ${targetChatId} (${numLimpo})...`);
    const msgResult = await client.sendMessage(targetChatId, String(message));

    console.log(`[${new Date().toLocaleTimeString()}] ✅ Mensagem enviada com sucesso para ${numLimpo}`);
    const messageId = (msgResult && msgResult.id) ? (msgResult.id._serialized || msgResult.id.id || 'OK') : 'OK';
    res.json({ success: true, messageId: messageId, to: numLimpo, resolvedJid: targetChatId });
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Página Web Visual com QR Code e Painel de Testes
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Painel WhatsApp — Angelim Construtora</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        :root { --bg: #0f1117; --card: #181b24; --text: #f0ead6; --accent: #c9a227; --green: #25d366; --border: rgba(255,255,255,0.1); }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
        .card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; width: 100%; max-width: 520px; padding: 32px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); text-align: center; }
        h1 { font-size: 1.4rem; color: var(--accent); margin-bottom: 6px; }
        p.sub { font-size: 0.85rem; color: rgba(240,234,214,0.6); margin-bottom: 24px; }
        .status-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 0.82rem; margin-bottom: 20px; }
        .status-badge.connected { background: rgba(37,211,102,0.15); color: var(--green); border: 1px solid rgba(37,211,102,0.3); }
        .status-badge.waiting { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }
        .qr-box { background: #fff; padding: 14px; border-radius: 12px; display: inline-block; margin: 10px 0 20px; }
        .qr-box img { display: block; width: 240px; height: 240px; }
        .test-box { background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; padding: 18px; text-align: left; margin-top: 16px; }
        .form-group { margin-bottom: 12px; }
        label { font-size: 0.76rem; font-weight: 700; color: rgba(240,234,214,0.8); display: block; margin-bottom: 4px; }
        input, textarea { width: 100%; background: #12141a; border: 1px solid var(--border); color: #fff; padding: 10px 12px; border-radius: 8px; font-family: inherit; font-size: 0.85rem; }
        input:focus, textarea:focus { outline: none; border-color: var(--accent); }
        button { width: 100%; background: var(--green); color: #000; font-weight: 800; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 0.9rem; transition: opacity 0.2s; }
        button:hover { opacity: 0.9; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>📲 Angelim Construtora</h1>
        <p class="sub">Servidor de Integração com WhatsApp</p>

        <div class="status-badge ${isConnected ? 'connected' : 'waiting'}">
          <span>${isConnected ? '🟢 Conectado e Pronto' : '🟡 Aguardando Leitura do QR Code'}</span>
        </div>

        ${!isConnected && currentQR ? `
          <div>
            <div style="font-size:0.85rem;margin-bottom:8px;">Abra o WhatsApp no celular > <strong>Aparelhos Conectados</strong> > <strong>Conectar Aparelho</strong>:</div>
            <div class="qr-box">
              <img src="${currentQR}" alt="QR Code WhatsApp">
            </div>
            <div style="font-size:0.75rem;color:rgba(240,234,214,0.5);">A página atualiza automaticamente após a leitura...</div>
            <script>setTimeout(() => location.reload(), 3500);</script>
          </div>
        ` : ''}

        ${!isConnected && !currentQR ? `
          <div style="padding:24px;color:rgba(240,234,214,0.6);font-size:0.88rem;">
            ⏳ Gerando QR Code de conexão...
            <script>setTimeout(() => location.reload(), 2500);</script>
          </div>
        ` : ''}

        ${isConnected ? `
          <div style="background:rgba(37,211,102,0.08);border:1px solid rgba(37,211,102,0.2);padding:14px;border-radius:12px;margin-bottom:16px;font-size:0.84rem;">
            ✅ <strong>WhatsApp conectado com sucesso!</strong><br>
            <span style="font-size:0.76rem;color:rgba(240,234,214,0.6);">Endpoint ativo: <code>POST http://localhost:3333/send-message</code></span>
          </div>

          <div class="test-box">
            <div style="font-weight:700;font-size:0.85rem;color:var(--accent);margin-bottom:10px;">🧪 Testar Disparo de Mensagem</div>
            <form onsubmit="event.preventDefault(); enviarTeste();">
              <div class="form-group">
                <label>Número de Destino (com DDD)</label>
                <input type="text" id="t-phone" placeholder="Ex: 95991234567" required>
              </div>
              <div class="form-group">
                <label>Mensagem</label>
                <textarea id="t-msg" rows="3" required>🚨 *ANGELIM CONSTRUTORA*\n\nTeste de envio de mensagem automática via servidor local realizado com sucesso!</textarea>
              </div>
              <button type="submit" id="t-btn">📲 Enviar Mensagem de Teste</button>
            </form>
            <div id="t-res" style="margin-top:10px;font-size:0.78rem;"></div>
          </div>

          <script>
            async function enviarTeste() {
              const btn = document.getElementById('t-btn');
              const resDiv = document.getElementById('t-res');
              const phone = document.getElementById('t-phone').value;
              const message = document.getElementById('t-msg').value;

              btn.disabled = true;
              btn.textContent = 'Enviando...';
              resDiv.innerHTML = '';

              try {
                const res = await fetch('/send-message', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ number: phone, message: message })
                });
                const data = await res.json();
                if (data.success) {
                  resDiv.innerHTML = '<span style="color:var(--green);font-weight:700;">✅ Mensagem enviada com sucesso!</span>';
                } else {
                  resDiv.innerHTML = '<span style="color:#ef4444;">Erro: ' + (data.error || 'Falha ao enviar') + '</span>';
                }
              } catch (err) {
                resDiv.innerHTML = '<span style="color:#ef4444;">Erro: ' + err.message + '</span>';
              } finally {
                btn.disabled = false;
                btn.textContent = '📲 Enviar Mensagem de Teste';
              }
            }
          </script>
        ` : ''}
      </div>
    </body>
    </html>
  `);
});

const { spawn } = require('child_process');

let publicUrl = null;
let cloudflaredProc = null;

function startCloudflareTunnel() {
  const binPath = path.join(__dirname, '..', '..', 'bin', 'cloudflared.exe');
  
  if (fs.existsSync(binPath)) {
    console.log('\nIniciando Túnel Seguro Cloudflare...');
    cloudflaredProc = spawn(binPath, ['tunnel', '--url', `http://localhost:${PORT}`]);

    cloudflaredProc.stderr.on('data', (data) => {
      const text = data.toString();
      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && !publicUrl) {
        publicUrl = match[0];
        console.log(`\n======================================================`);
        console.log(`🌐 URL PÚBLICA CLOUDFLARE HTTPS (100% ESTÁVEL E DIRETA):`);
        console.log(`👉 ${publicUrl}/send-message`);
        console.log(`======================================================\n`);
      }
    });

    cloudflaredProc.on('close', () => {
      publicUrl = null;
      console.log('Túnel Cloudflare encerrado. Reiniciando em 5s...');
      setTimeout(startCloudflareTunnel, 5000);
    });
  }
}

// Inicia o servidor Express
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 SERVIDOR WHATSAPP ANGELIM INICIADO NA PORTA ${PORT}`);
  console.log(`🌐 Painel Web: http://localhost:${PORT}`);
  console.log(`======================================================`);
  startCloudflareTunnel();
});
