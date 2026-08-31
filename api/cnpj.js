// api/cnpj.js — Proxy para BrasilAPI (evita CORS no frontend)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { cnpj } = req.query;
  if (!cnpj) return res.status(400).json({ error: 'CNPJ não informado' });

  const cnpjLimpo = cnpj.replace(/\D/g, '');
  if (cnpjLimpo.length !== 14) return res.status(400).json({ error: 'CNPJ inválido' });

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'AngelimConstrutora/1.0' }
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Erro ao consultar BrasilAPI', detail: err.message });
  }
}
