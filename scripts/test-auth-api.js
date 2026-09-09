import dotenv from 'dotenv';
import { pathToFileURL } from 'url';

dotenv.config({ path: '.env.local' });
dotenv.config();

const authModule = await import(pathToFileURL(process.cwd() + '/api/auth.js').href);
const handler = authModule.default;

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

async function run() {
  console.log('--- Teste 1: Login com admin / admin123 ---');
  const t1 = mockReqRes({
    method: 'POST',
    body: { action: 'login', username: 'admin', password: 'admin123' }
  });
  await handler(t1.req, t1.res);
  const r1 = t1.getResult();
  console.log('Status:', r1.status, 'Success:', r1.body?.success, 'Tenant:', r1.body?.user?.tenantId);
  const adminToken = r1.body?.token;

  console.log('\n--- Teste 2: Login com senha errada ---');
  const t2 = mockReqRes({
    method: 'POST',
    body: { action: 'login', username: 'admin', password: 'senhaErrada' }
  });
  await handler(t2.req, t2.res);
  const r2 = t2.getResult();
  console.log('Status:', r2.status, 'Success:', r2.body?.success, 'Message:', r2.body?.message);

  console.log('\n--- Teste 3: Login com empresa / empresa123 ---');
  const t3 = mockReqRes({
    method: 'POST',
    body: { action: 'login', username: 'empresa', password: 'empresa123' }
  });
  await handler(t3.req, t3.res);
  const r3 = t3.getResult();
  console.log('Status:', r3.status, 'Success:', r3.body?.success, 'Tenant:', r3.body?.user?.tenantId);

  console.log('\n--- Teste 4: GET /api/auth?action=me com token admin ---');
  const t4 = mockReqRes({
    method: 'GET',
    query: { action: 'me' },
    headers: { authorization: `Bearer ${adminToken}` }
  });
  await handler(t4.req, t4.res);
  const r4 = t4.getResult();
  console.log('Status:', r4.status, 'User:', r4.body?.user?.username, 'Tenant:', r4.body?.tenant?.id);
}

run().catch(console.error);
