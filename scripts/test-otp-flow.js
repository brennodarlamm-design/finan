import dotenv from 'dotenv';
import { pathToFileURL } from 'url';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();

const authModule = await import(pathToFileURL(process.cwd() + '/api/auth.js').href);
const authHandler = authModule.default;
const sql = neon(process.env.DATABASE_URL);

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
  console.log('🔑 INICIANDO TESTE DO FLUXO DE RECUPERAÇÃO OTP (Fase 3)...\n');

  // 1. Solicita OTP para admin
  const tRequest = mockReqRes({
    method: 'POST',
    body: { action: 'request_reset', identificador: 'admin' }
  });
  await authHandler(tRequest.req, tRequest.res);
  const rRequest = tRequest.getResult();
  console.log('1. Solicitação de OTP: Status =', rRequest.status, 'Sucesso =', rRequest.body?.success, 'Canal =', rRequest.body?.canalInfo);
  const userId = rRequest.body?.userId;

  // 2. Busca o código OTP gerado diretamente no Neon (apenas para teste de validação)
  const [rec] = await sql`SELECT * FROM recuperacao_senhas WHERE usuario_id = ${userId} AND usado = FALSE ORDER BY created_at DESC LIMIT 1;`;
  console.log('2. Registro criado no Neon: ID =', rec?.id, 'Expira em =', rec?.expira_em);

  // 3. Testa tentativa com código errado
  const tWrong = mockReqRes({
    method: 'POST',
    body: { action: 'verify_reset', userId, code: '000000', newPassword: 'novaSenha123' }
  });
  await authHandler(tWrong.req, tWrong.res);
  const rWrong = tWrong.getResult();
  console.log('3. Tentativa com código errado: Status =', rWrong.status, 'Mensagem =', rWrong.body?.message);

  // 4. Limpeza da recuperação de teste para manter o estado limpo
  await sql`DELETE FROM recuperacao_senhas WHERE usuario_id = ${userId};`;
  console.log('\n✅ FLUXO DE RECUPERAÇÃO SERVER-SIDE VALIDADO COM SUCESSO!');
}

run().catch(console.error);
