// scripts/test-patch15-static.js — Validação estática do Patch 15 (v2.15.0)
import fs from 'fs';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ ${message}`);
    passed++;
  } else {
    console.error(`❌ FALHA: ${message}`);
    failed++;
  }
}

console.log('\n--- TESTES ESTÁTICOS DO PATCH 15 (Upload/Blob, Logout Seguro, CORS/Origens, Resend OTP, API CEP & Resiliência JSON) ---\n');

// 1. Validando api/upload.js (H-17 e H-18)
console.log('[1/7] Validando api/upload.js (H-17 e H-18)...');
const uploadCode = fs.readFileSync('api/upload.js', 'utf8');
assert(
  !uploadCode.includes("url.includes(`/${tenantId}/`)"),
  'api/upload.js não usa mais includes(`/${tenantId}/`) frágil para exclusão (H-17)'
);
assert(
  uploadCode.includes('cleanPath.startsWith(`${tenantId}/`)'),
  'api/upload.js valida caminho canônico iniciando com tenantId/ (H-17)'
);
assert(
  uploadCode.includes('ALLOWED_EXTENSIONS') && uploadCode.includes('ALLOWED_MIMES'),
  'api/upload.js possui allowlist positiva estrita de extensões e tipos MIME (H-18)'
);
assert(
  uploadCode.includes('MAX_UPLOAD_BYTES') && uploadCode.includes('15 * 1024 * 1024'),
  'api/upload.js impõe limite de 15 MB pós-decodificação de buffer'
);
assert(
  uploadCode.includes('suspiciousExts') && uploadCode.includes('parts.length > 2'),
  'api/upload.js detecta e rejeita arquivos com extensões executáveis ocultas'
);

// 2. Validando js/auth.js (H-16)
console.log('\n[2/7] Validando js/auth.js (H-16)...');
const authJsCode = fs.readFileSync('js/auth.js', 'utf8');
assert(
  authJsCode.includes('logoutSilently') && authJsCode.includes('localStorage.removeItem(k)'),
  'js/auth.js expurga chaves do tenant do localStorage no logout (H-16)'
);
assert(
  authJsCode.includes("k.startsWith('finobra_')") && authJsCode.includes("k.startsWith('finobra_sync_')"),
  'js/auth.js limpa coleções e filas locais de sincronização no logout'
);
assert(
  authJsCode.includes('finobra_theme'),
  'js/auth.js preserva preferências de tema visual do usuário no logout'
);

// 3. Validando api/_auth.js (H-20 e H-21)
console.log('\n[3/7] Validando api/_auth.js (H-20 e H-21)...');
const authBackendCode = fs.readFileSync('api/_auth.js', 'utf8');
assert(
  !authBackendCode.includes('req.headers?.host'),
  'api/_auth.js não deriva origens confiáveis a partir do header Host não confiável (H-21)'
);
assert(
  authBackendCode.includes('finan|finobra') && authBackendCode.includes('vercel'),
  'api/_auth.js restringe origens vercel.app para subdomínios do projeto FinObra (H-20)'
);

// 4. Validando api/auth.js (H-10)
console.log('\n[4/7] Validando api/auth.js (H-10)...');
const apiAuthCode = fs.readFileSync('api/auth.js', 'utf8');
assert(
  apiAuthCode.includes('https://api.resend.com/emails') && apiAuthCode.includes('RESEND_API_KEY'),
  'api/auth.js integra envio real de OTP por e-mail com Resend (H-10)'
);
assert(
  apiAuthCode.includes('emailSent') && apiAuthCode.includes('canaisUtilizados'),
  'api/auth.js reporta no canalInfo apenas os canais que realmente receberam o código'
);

// 5. Validando API de CEP em api/nfe.js e vercel.json
console.log('\n[5/7] Validando API de CEP...');
const nfeCode = fs.readFileSync('api/nfe.js', 'utf8');
assert(
  nfeCode.includes('isCep') && nfeCode.includes('cepLimpo.length !== 8'),
  'api/nfe.js valida CEP numérico de 8 dígitos'
);
assert(
  nfeCode.includes('https://brasilapi.com.br/api/cep/v1/') && nfeCode.includes('https://viacep.com.br/ws/'),
  'api/nfe.js implementa consulta primária na BrasilAPI com fallback no ViaCEP'
);

const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const hasCepRewrite = vercelConfig.rewrites.some(r => r.source === '/api/cep' && r.destination === '/api/nfe?action=cep');
assert(hasCepRewrite, 'vercel.json possui rewrite /api/cep -> /api/nfe?action=cep');
const cspHeader = vercelConfig.headers[0].headers.find(h => h.key === 'Content-Security-Policy');
assert(
  cspHeader && cspHeader.value.includes('https://viacep.com.br'),
  'vercel.json inclui https://viacep.com.br no connect-src da CSP'
);

// 6. Validando Frontend e Auto-Preenchimento por CEP
console.log('\n[6/7] Validando Frontend e Auto-Preenchimento por CEP...');
const utilsCode = fs.readFileSync('js/utils.js', 'utf8');
assert(
  utilsCode.includes('async consultarCep(') && utilsCode.includes('_cepCache'),
  'js/utils.js exporta consultarCep com cache em memória'
);

const fornCode = fs.readFileSync('js/fornecedores.js', 'utf8');
assert(
  fornCode.includes('onCepChange') && (
    fornCode.includes('onblur="Fornecedores.onCepChange(this)"') ||
    fornCode.includes('data-fb-blur="Fornecedores.onCepChange"')
  ),
  'js/fornecedores.js implementa auto-preenchimento por CEP'
);

const cliCode = fs.readFileSync('js/clientes.js', 'utf8');
assert(
  cliCode.includes('onCepChange') && (
    cliCode.includes('onblur="Clientes.onCepChange(this)"') ||
    cliCode.includes('data-fb-blur="Clientes.onCepChange"')
  ),
  'js/clientes.js implementa auto-preenchimento por CEP'
);

const cfgCode = fs.readFileSync('js/configuracoes.js', 'utf8');
assert(
  cfgCode.includes('buscarCep') && (
    cfgCode.includes('onblur="Configuracoes.buscarCep(this)"') ||
    cfgCode.includes('data-fb-blur="Configuracoes.buscarCep"')
  ),
  'js/configuracoes.js implementa auto-preenchimento por CEP'
);

// 7. Validando Resiliência JSON em api/db.js (M-02)
console.log('\n[7/7] Validando Resiliência JSON em api/db.js (M-02)...');
const dbCode = fs.readFileSync('api/db.js', 'utf8');
assert(
  dbCode.includes('function safeJsonParse(value, fallback = [])'),
  'api/db.js define função safeJsonParse com try/catch e fallback seguro (M-02)'
);
assert(
  !dbCode.includes('JSON.parse(m.itens_json)') && !dbCode.includes('JSON.parse(o.itens_json)'),
  'api/db.js não possui chamadas desprotegidas de JSON.parse em itens_json'
);
assert(
  !dbCode.includes("JSON.parse(l.itens || '[]')") && !dbCode.includes("JSON.parse(n.itens || '[]')"),
  'api/db.js não possui chamadas desprotegidas de JSON.parse em itens de lancamentos ou notas'
);

console.log(`\nResultado dos testes do Patch 15: ${passed}/${passed + failed} passaram.`);
if (failed > 0) {
  console.error(`❌ ${failed} teste(s) falharam!`);
  process.exit(1);
} else {
  console.log('Todos os testes do Patch 15 passaram com sucesso!\n');
}
