// api/recuperar-senha.js — Envio de Código de Verificação (OTP) para Recuperação de Senha

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

export default async function handler(req, res) {
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

  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, apikey');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    const { phone, email, code, userName, tenantName } = req.body || {};

    if (!code) {
      return res.status(400).json({ error: 'Código de verificação é obrigatório.' });
    }

    const mensagemOtp = `*FinObra — Código de Verificação*\n\nOlá, ${userName || 'Construtor'}!\n\nSeu código de validação para redefinir sua senha é:\n\n👉 *${code}*\n\nEste código é válido por *10 minutos*. Se você não solicitou a redefinição de senha, ignore esta mensagem.`;

    let whatsappSent = false;
    let whatsappError = null;

    // Se houver telefone, dispara via WhatsApp com autenticação de segurança
    const destPhone = (phone || '').replace(/\D/g, '');
    if (destPhone) {
      const numFmt = destPhone.startsWith('55') ? destPhone : `55${destPhone}`;
      const renderUrl = 'https://finan-wf12.onrender.com/send-message';
      const secret = (process.env.API_SECRET || process.env.VERCEL_API_SECRET || '').trim();

      try {
        const waResp = await fetch(renderUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': secret
          },
          body: JSON.stringify({
            phone: numFmt,
            message: mensagemOtp
          })
        });
        const waData = await waResp.json().catch(() => ({}));
        if (waResp.ok && waData.success) {
          whatsappSent = true;
        } else {
          whatsappError = waData.error || 'Falha na resposta do servidor WhatsApp';
        }
      } catch (errWa) {
        whatsappError = errWa.message;
      }
    }

    return res.status(200).json({
      success: true,
      whatsappSent,
      whatsappError,
      message: whatsappSent 
        ? 'Código de validação enviado com sucesso para o WhatsApp!' 
        : 'Código de validação gerado com sucesso.'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno ao processar recuperação de senha', detail: err.message });
  }
}
