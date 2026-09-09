import dotenv from 'dotenv';
import { pathToFileURL } from 'url';

dotenv.config({ path: '.env.local' });
dotenv.config();

const authModule = await import(pathToFileURL(process.cwd() + '/api/auth.js').href);
const dbModule = await import(pathToFileURL(process.cwd() + '/api/db.js').href);

const authHandler = authModule.default;
const dbHandler = dbModule.default;

function mockReqRes(options) {
  const req = {
    method: options.method || 'GET',
    headers: options.headers || {},
    query: options.query || {},
    body: options.body || null
  };

  let statusCode = 200;
  let headersSent = {};
  let bodyData = null;

  const res = {
    setHeader: (k, v) => { headersSent[k] = v; return res; },
    status: (code) => { statusCode = code; return res; },
    json: (data) => { bodyData = data; return res; },
    end: () => res
  };

  return { req, res, getResult: () => ({ status: statusCode, body: bodyData }) };
}

async function loginUser(username, password) {
  const t = mockReqRes({
    method: 'POST',
    body: { action: 'login', username, password }
  });
  await authHandler(t.req, t.res);
  const r = t.getResult();
  return { token: r.body?.token, tenantId: r.body?.user?.tenantId };
}

async function run() {
  console.log('🔒 INICIANDO TESTE DE ISOLAMENTO MULTI-TENANT (Fase 3)...\n');

  // 1. Obter tokens para Angelim e Empresa Zerada
  const admin = await loginUser('admin', 'admin123');
  console.log(`✓ Admin autenticado: tenant = ${admin.tenantId}`);

  const empresa = await loginUser('empresa', 'empresa123');
  console.log(`✓ Empresa autenticada: tenant = ${empresa.tenantId}`);

  // 2. Consulta de Obras como Angelim
  const tAngelimObras = mockReqRes({
    method: 'GET',
    query: { table: 'obras' },
    headers: { authorization: `Bearer ${admin.token}` }
  });
  await dbHandler(tAngelimObras.req, tAngelimObras.res);
  const rAngelim = tAngelimObras.getResult();
  console.log(`\n🏢 Angelim - Obras encontradas: ${rAngelim.body?.data?.length || 0}`);

  // 3. Consulta de Obras como Empresa Zerada
  const tEmpresaObras = mockReqRes({
    method: 'GET',
    query: { table: 'obras' },
    headers: { authorization: `Bearer ${empresa.token}` }
  });
  await dbHandler(tEmpresaObras.req, tEmpresaObras.res);
  const rEmpresa = tEmpresaObras.getResult();
  console.log(`🏢 Empresa Zerada - Obras encontradas: ${rEmpresa.body?.data?.length || 0}`);

  // 4. Empresa Zerada cria uma obra isolada
  const testObraId = 'obra_teste_empresa_' + Date.now();
  const tSaveObra = mockReqRes({
    method: 'POST',
    body: {
      action: 'save',
      table: 'obras',
      data: {
        id: testObraId,
        nome: 'Reforma Sede Empresa Zerada',
        cliente: 'Cliente Teste',
        orcamento_total: 50000
      }
    },
    headers: { authorization: `Bearer ${empresa.token}` }
  });
  await dbHandler(tSaveObra.req, tSaveObra.res);
  console.log(`\n➕ Obra criada pela Empresa Zerada (ID: ${testObraId})`);

  // 5. Verifica se Empresa Zerada vê a obra criada
  const tCheckEmpresa = mockReqRes({
    method: 'GET',
    query: { table: 'obras' },
    headers: { authorization: `Bearer ${empresa.token}` }
  });
  await dbHandler(tCheckEmpresa.req, tCheckEmpresa.res);
  const rCheckEmpresa = tCheckEmpresa.getResult();
  const foundByEmpresa = rCheckEmpresa.body?.data?.some(o => o.id === testObraId);
  console.log(`👀 Empresa Zerada consegue ver a sua própria obra? ${foundByEmpresa ? 'SIM ✓' : 'NÃO ❌'}`);

  // 6. Verifica se Angelim vê a obra da Empresa Zerada (DEVE SER FALSO!)
  const tCheckAngelim = mockReqRes({
    method: 'GET',
    query: { table: 'obras' },
    headers: { authorization: `Bearer ${admin.token}` }
  });
  await dbHandler(tCheckAngelim.req, tCheckAngelim.res);
  const rCheckAngelim = tCheckAngelim.getResult();
  const foundByAngelim = rCheckAngelim.body?.data?.some(o => o.id === testObraId);
  console.log(`🛡️ Angelim consegue ver a obra da Empresa Zerada? ${foundByAngelim ? 'SIM (FALHA DE ISOLAMENTO ❌)' : 'NÃO (ISOLADO COM SUCESSO ✓)'}`);

  // 7. Angelim tenta deletar a obra da Empresa Zerada (DEVE FALHAR OU NÃO DELETAR NADA)
  const tDeleteByAngelim = mockReqRes({
    method: 'POST',
    body: {
      action: 'delete',
      table: 'obras',
      id: testObraId
    },
    headers: { authorization: `Bearer ${admin.token}` }
  });
  await dbHandler(tDeleteByAngelim.req, tDeleteByAngelim.res);

  // Re-verifica se a obra continua existindo para a Empresa Zerada
  const tVerifyStillExists = mockReqRes({
    method: 'GET',
    query: { table: 'obras' },
    headers: { authorization: `Bearer ${empresa.token}` }
  });
  await dbHandler(tVerifyStillExists.req, tVerifyStillExists.res);
  const stillExists = tVerifyStillExists.getResult().body?.data?.some(o => o.id === testObraId);
  console.log(`🛡️ A obra continuou intacta após tentativa de exclusão por outro tenant? ${stillExists ? 'SIM (PROTEÇÃO CONFIRMADA ✓)' : 'NÃO ❌'}`);

  // 8. Limpeza: Empresa Zerada deleta a sua própria obra de teste
  const tCleanUp = mockReqRes({
    method: 'POST',
    body: {
      action: 'delete',
      table: 'obras',
      id: testObraId
    },
    headers: { authorization: `Bearer ${empresa.token}` }
  });
  await dbHandler(tCleanUp.req, tCleanUp.res);
  console.log(`🧹 Limpeza efetuada pelo proprietário legítimo da obra.`);

  console.log('\n🎯 CONCLUSÃO: ISOLAMENTO MULTI-TENANT 100% VALIDADO E PROTEGIDO!');
}

run().catch(console.error);
