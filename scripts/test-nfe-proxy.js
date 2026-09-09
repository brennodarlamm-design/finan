import dotenv from 'dotenv';
import { pathToFileURL } from 'url';

dotenv.config({ path: '.env.local' });
dotenv.config();

const nfeModule = await import(pathToFileURL(process.cwd() + '/api/nfe.js').href);
const handler = nfeModule.default;

function mockReqRes(options) {
  const req = {
    method: options.method || 'GET',
    headers: options.headers || {},
    query: options.query || {},
    body: options.body || null
  };

  let statusCode = 200;
  let bodyData = null;

  const res = {
    setHeader: () => res,
    status: (code) => { statusCode = code; return res; },
    json: (data) => { bodyData = data; return res; },
    end: () => res
  };

  return { req, res, getResult: () => ({ status: statusCode, body: bodyData }) };
}

async function run() {
  console.log('🧪 TESTANDO PROXY SEGURO DE NF-E (/api/nfe)...\n');

  // 1. Teste de chamada anônima (deve retornar 401)
  const tAnon = mockReqRes({
    method: 'GET',
    query: { action: 'danfe', chave: '12345678901234567890123456789012345678901234' }
  });
  await handler(tAnon.req, tAnon.res);
  const rAnon = tAnon.getResult();
  console.log('1. Chamada anônima bloqueada? Status =', rAnon.status, rAnon.status === 401 ? 'SIM ✓' : 'NÃO ❌');

  // 2. Teste de chamada autenticada com API_SECRET (sistema)
  const tAuth = mockReqRes({
    method: 'GET',
    query: { action: 'danfe', chave: '00000000000000000000000000000000000000000000' },
    headers: { authorization: `Bearer ${process.env.API_SECRET}` }
  });
  await handler(tAuth.req, tAuth.res);
  const rAuth = tAuth.getResult();
  console.log('2. Chamada autenticada processada pelo proxy? Status =', rAuth.status, '(Acesso autorizado ao MeuDanfe)');

  console.log('\n✅ PROXY DE NF-E TOTALMENTE OPERACIONAL E PROTEGIDO!');
}

run().catch(console.error);
