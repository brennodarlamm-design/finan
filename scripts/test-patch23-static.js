import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;
const read = p => fs.readFileSync(path.resolve(p), 'utf8');
const ok = (name, condition) => {
  if (condition) { console.log(`✓ ${name}`); passed++; }
  else { console.error(`✗ ${name}`); failed++; }
};

console.log('=== FinObra Patch 23 — Security Closure ===');

const cert = read('api/_certificado.js');
const upload = read('api/upload.js');
const backend = read('backend/server.js');
const apiFiles = fs.readdirSync('api').filter(n => n.endsWith('.js')).map(n => read(`api/${n}`)).join('\n');

ok('CORS não aceita qualquer *.vercel.app', !apiFiles.includes("endsWith('.vercel.app')") && !apiFiles.includes('endsWith(".vercel.app")'));
ok('CORS reconhece somente previews do projeto finan-as', /finan-as\(\?:-\[a-z0-9-\]\+\)\?/.test(apiFiles) || apiFiles.includes('finan-as(?:-[a-z0-9-]+)?'));
ok('Certificado suporta chave dedicada CERT_ENCRYPTION_KEY', cert.includes('CERT_ENCRYPTION_KEY'));
ok('Certificado mantém fallback de decriptação legado para rotação segura', cert.includes('legacy') && cert.includes('decryptWithSecret'));
ok('Upload público não permite SVG', !/allowedContentTypes:[\s\S]{0,500}image\/svg\+xml/.test(upload));
ok('Upload direto limita arquivo a 15 MB', upload.includes('15 * 1024 * 1024'));
ok('Upload não devolve err.message bruto ao cliente em exclusão', !upload.includes("'Erro ao excluir arquivo: ' + err.message"));
ok('WhatsApp reduz limite HTTP para 12 MB', backend.includes("express.json({ limit: '12mb' })"));
ok('WhatsApp exige phone explícito em /send-message', backend.includes("const destPhone = String(phone || '').replace(/\\D/g, '');") && !backend.includes('const destPhone = phone || TARGET_PHONE;'));
ok('WhatsApp limita mídia decodificada a 8 MB', backend.includes('MAX_MEDIA_BYTES = 8 * 1024 * 1024'));
ok('WhatsApp bloqueia HTML/SVG/JavaScript como mídia', backend.includes('forbiddenMime'));
ok('Erro fatal não recuperável encerra processo para restart do Render', backend.includes('process.exit(1)'));

console.log(`\nPatch 23: ${passed}/${passed + failed} verificações passaram.`);
if (failed) process.exit(1);
