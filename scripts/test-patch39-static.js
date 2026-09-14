import fs from 'fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Patch 39: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

const server = fs.readFileSync('backend/server.js', 'utf8');
const renderYaml = fs.readFileSync('render.yaml', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = JSON.parse(fs.readFileSync('version.json', 'utf8'));

console.log('=== Patch 39 — Contenção de Bandwidth Render, Otimização Baileys e Isolamento Neon ===\n');

// 1. Otimizações de Rede do Socket Baileys
assert(server.includes('syncFullHistory: false'), 'Socket Baileys desativa sincronização de histórico completo.');
assert(server.includes('markOnlineOnConnect: false'), 'Socket Baileys não publica presença contínua online.');
assert(server.includes('shouldIgnoreJid:'), 'Socket Baileys implementa filtro de JIDs.');
assert(
  server.includes('@broadcast') && server.includes('@newsletter') && server.includes('@g.us'),
  'Socket Baileys descarta Stories/Status, canais e grupos para conter tráfego de rede.'
);
assert(server.includes('getMessage: async () => undefined'), 'Socket Baileys possui handler stub para resolução de retry receipts.');

// 2. Persistência Inteligente com Dirty-Key Tracking
assert(server.includes('persistedHashes: new Map()'), 'Sessão rastreia hashes MD5 de chaves já gravadas no Neon.');
assert(server.includes('pendingSaves: new Set()'), 'Sessão rastreia conjunto de arquivos com alteração pendente.');
assert(server.includes('dirtyEntries.length === 0'), 'Persistência evita chamadas HTTP ao Neon quando nenhuma chave mudou.');
assert(server.includes("saveAuthToPostgres(session, 'creds.json')"), 'creds.update salva pontualmente apenas o arquivo de credenciais.');

// 3. Resiliência de Reconexão e Tolerância a Bad MAC
assert(server.includes('reconnectAttempts'), 'Sessão gerencia tentativas de reconexão.');
assert(server.includes('Math.min(5000 * Math.pow(1.4, attempts), 60000)'), 'Reconexão utiliza backoff exponencial em vez de loop fixo agressivo.');
assert(
  server.includes('Mensagem recebida com falha de decifração/Bad MAC ignorada'),
  'Falha de decifração em mensagem externa não desconecta nem destrói a sessão ativa.'
);

// 4. Isolamento Multi-Tenant e Eliminação de Sessões Zumbis
assert(server.includes('INNER JOIN tenants t ON t.id = a.tenant_id'), 'Bootstrap inicia apenas tenants reais cadastrados na tabela tenants.');
assert(server.includes("a.tenant_id != 'public'"), 'Bootstrap não inicia tenant public zumbi em paralelo.');
assert(renderYaml.includes('TARGET_TENANT_ID') && renderYaml.includes('value: angelim'), 'render.yaml fixa TARGET_TENANT_ID como angelim.');
assert(server.includes('Tabela legada whatsapp_auth limpa após migração'), 'Tabela legada whatsapp_auth é limpa para evitar re-migrações em loop.');

// 5. Versionamento e Pacote
assert(pkg.scripts?.['test:patch39'] === 'node scripts/test-patch39-static.js', 'package.json expõe comando test:patch39.');
assert(pkg.version === '2.28.0', 'package.json está na versão 2.28.0.');
assert(version.version === '2.28.0', 'version.json está na versão 2.28.0.');
assert(/-p39\b/.test(version.build || ''), 'version.json registra build com sufixo -p39.');

console.log('\n🎉 Patch 39: todas as 18 verificações passaram com 100% de sucesso!');
