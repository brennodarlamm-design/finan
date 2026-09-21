import fs from 'fs';
import path from 'path';

console.log('\n=== Suíte de Testes: Termos de Uso, Privacidade & Banner Global de Cookies ===\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FALHA: ${message}`);
    failCount++;
  }
}

// 1. Validar termos.html
console.log('1. Validando Termos de Serviço (termos.html)...');
const termos = fs.readFileSync(path.resolve('termos.html'), 'utf8');
assert(termos.includes('Da Custódia, Armazenamento e Upload de Arquivos'), 'termos.html possui seção dedicada de custódia e upload de arquivos');
assert(termos.includes('Titularidade Exclusiva do Cliente'), 'termos.html define titularidade 100% exclusiva da construtora');
assert(termos.includes('Cloudflare R2 Object Storage') || termos.includes('R2 Object Storage'), 'termos.html especifica armazenamento seguro em nuvem');
assert(termos.includes('AES-256') && termos.includes('TLS 1.3'), 'termos.html descreve criptografia em trânsito e em repouso');
assert(termos.includes('Magic Bytes'), 'termos.html detalha proteção contra arquivos executáveis e validação Magic Bytes');
assert(termos.includes('30 (trinta) dias para exportação') || termos.includes('30 dias'), 'termos.html especifica prazo de exportação e expurgo seguro');
assert(termos.includes('Responsabilidade Técnica de Engenharia'), 'termos.html delimita responsabilidade técnica de engenheiros/ARTs');

// 2. Validar privacidade.html
console.log('\n2. Validando Política de Privacidade (privacidade.html)...');
const privacidade = fs.readFileSync(path.resolve('privacidade.html'), 'utf8');
assert(privacidade.includes('Tratamento de Dados em Arquivos e Documentos Enviados pelo Cliente (Uploads)'), 'privacidade.html possui seção específica de dados em uploads');
assert(privacidade.includes('Controladora de Dados') && privacidade.includes('Operador de Dados'), 'privacidade.html delimita papéis de Controlador e Operador conforme LGPD');
assert(privacidade.includes('Política de Cookies e Tecnologias de Sessão'), 'privacidade.html possui seção dedicada de cookies e tecnologias de sessão');
assert(privacidade.includes('finobra_session_token') && privacidade.includes('HttpOnly'), 'privacidade.html detalha cookies de sessão HttpOnly/Secure');
assert(privacidade.includes('fingo_cookie_consent_v2'), 'privacidade.html referencia a chave de consentimento local');

// 3. Validar js/cookie_banner.js
console.log('\n3. Validando Componente Global de Cookies (js/cookie_banner.js)...');
const bannerPath = path.resolve('js/cookie_banner.js');
assert(fs.existsSync(bannerPath), 'js/cookie_banner.js existe no repositório');
const bannerCode = fs.readFileSync(bannerPath, 'utf8');
assert(bannerCode.includes('fingo_cookie_consent_v2'), 'cookie_banner.js utiliza chave de consentimento fingo_cookie_consent_v2');
assert(bannerCode.includes('href="/termos"') && bannerCode.includes('href="/privacidade"'), 'cookie_banner.js inclui links diretos para termos e privacidade');
assert(bannerCode.includes('#C6FF00') || bannerCode.includes('var(--accent'), 'cookie_banner.js aplica paleta de design Brutalist Tech');
assert(bannerCode.includes('fingo-cb-accept-btn'), 'cookie_banner.js possui botão de aceite e persistência');

const react = fs.readFileSync('marketing/main.jsx','utf8');
assert(react.includes('fingo_cookie_consent_v2') && react.includes('<CookieNotice />'), 'Landing React mantém aviso de privacidade e preferência persistida');
// 4. Validar injeção do banner nas páginas HTML
console.log('\n4. Validando carregamento do banner nas páginas da aplicação...');
const htmlPages = [
  'index.html',
  'app.html',
  'master.html',
  'termos.html',
  'privacidade.html',
  'validar.html'
];

for (const page of htmlPages) {
  const content = fs.readFileSync(path.resolve(page), 'utf8');
  assert(content.includes('cookie_banner.js'), `${page} importa js/cookie_banner.js`);
}

console.log(`\n======================================================`);
console.log(`Resultado: ${passCount}/${passCount + failCount} testes aprovados.`);
if (failCount > 0) {
  console.error(`❌ ${failCount} falhas encontradas na validação jurídica e de cookies.`);
  process.exit(1);
} else {
  console.log(`🎉 Termos, Privacidade e Banner de Cookies validados com 100% de sucesso!`);
  console.log(`======================================================\n`);
}
