// scripts/security-secrets-scanner.cjs — Scanner Estrito Anti-Vazamento de Credenciais
// Bloqueia qualquer tentativa de commit ou presença de segredos em arquivos rastreados pelo Git.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🛡️  [Security Gate] Iniciando varredura estrita de credenciais em arquivos rastreados...');

const root = path.resolve(__dirname, '..');

// 1. Obter todos os arquivos versionados pelo git
let trackedFiles = [];
try {
  const output = execSync('git ls-files', { cwd: root, encoding: 'utf8' });
  trackedFiles = output.split('\n').map(f => f.trim()).filter(Boolean);
} catch (err) {
  console.error('❌ Falha ao listar arquivos versionados pelo Git:', err.message);
  process.exit(1);
}

// 2. Extensões e arquivos a ignorar (apenas binários ou arquivos já protegidos por padrão)
const IGNORE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.webp', '.zip', '.gz', '.woff', '.woff2', '.ttf', '.eot']);
const ALLOWED_FILES = new Set(['package-lock.json']);

// 3. Padrões proibidos com alta sensibilidade
const FORBIDDEN_PATTERNS = [
  {
    name: 'Neon Postgres Password (npg_)',
    regex: /npg_[a-zA-Z0-9_-]{10,}/g
  },
  {
    name: 'Hardcoded PostgreSQL Connection String with Credentials',
    regex: /postgres(?:ql)?:\/\/(?!postgres:postgres@localhost)[a-zA-Z0-9_\-\.]+:[^@\s'"\\]+@[a-zA-Z0-9_\-\.]+\.[a-z]{2,}/gi
  },
  {
    name: 'Private Key Block',
    regex: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/g
  },
  {
    name: 'AWS Secret Access Key',
    regex: /(?:aws_secret_access_key|aws_sec_key)\s*[:=]\s*['"][a-zA-Z0-9/+=]{40}['"]/gi
  },
  {
    name: 'Hardcoded Render API Key',
    regex: /rnd_[a-zA-Z0-9]{20,}/g
  },
  {
    name: 'Hardcoded Cloudflare Token',
    regex: /(?:CLOUDFLARE_API_TOKEN|CF_API_TOKEN)\s*[:=]\s*['"][a-zA-Z0-9_-]{30,}['"]/gi
  },
  {
    name: 'Hardcoded OpenAI / AI Secret Key',
    regex: /sk-[a-zA-Z0-9_-]{32,}/g
  }
];

let violations = [];

for (const relPath of trackedFiles) {
  const ext = path.extname(relPath).toLowerCase();
  if (IGNORE_EXTENSIONS.has(ext) || ALLOWED_FILES.has(relPath)) continue;

  const fullPath = path.join(root, relPath);
  if (!fs.existsSync(fullPath)) continue;

  let content = '';
  try {
    content = fs.readFileSync(fullPath, 'utf8');
  } catch {
    continue; // ignora se não for utf8 legível
  }

  // Ignora se for este próprio arquivo de verificação
  if (relPath.replace(/\\/g, '/').endsWith('scripts/security-secrets-scanner.cjs')) {
    continue;
  }

  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // Ignora linhas de comentários que contenham documentação de redatores ou placeholders explícitos
    if (line.includes('[REDACTED') || line.includes('[USER]') || line.includes('[PASS]') || line.includes('[SEU_') || line.includes('placeholder')) {
      return;
    }

    for (const pattern of FORBIDDEN_PATTERNS) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line)) {
        violations.push({
          file: relPath,
          line: idx + 1,
          rule: pattern.name,
          preview: line.trim().slice(0, 100)
        });
      }
    }
  });
}

if (violations.length > 0) {
  console.error('\n🚨 =========================================================================');
  console.error('🚨 VIOLAÇÃO CRÍTICA DE SEGURANÇA: CREDENCIAIS EXPOSTAS DETECTADAS NO REPOSITÓRIO!');
  console.error('🚨 =========================================================================');
  console.error(`Foram encontradas ${violations.length} ocorrência(s) de credenciais/senhas em arquivos rastreados:\n`);

  violations.forEach((v, i) => {
    console.error(`  [${i + 1}] Arquivo: ${v.file}:${v.line}`);
    console.error(`      Regra: ${v.rule}`);
    console.error(`      Linha: ${v.preview}...`);
    console.error('');
  });

  console.error('❌ AÇÃO BLOQUEADA: Remova imediatamente todas as credenciais reais.');
  console.error('   Utilize EXCLUSIVAMENTE variáveis de ambiente (process.env) em tempo de execução.');
  process.exit(1);
}

console.log(`✅ [Security Gate] 100% aprovado! ${trackedFiles.length} arquivos analisados sem nenhum segredo exposto.\n`);
process.exit(0);
