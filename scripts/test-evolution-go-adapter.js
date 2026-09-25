// scripts/test-evolution-go-adapter.js
// Suíte de Testes Automatizados — Validação do Adaptador Evolution Go (Golang) no FinGo

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EvolutionGoClient } from '../backend/domains/atendimento/evolution_client.js';

console.log('=== Testes do Adaptador Evolution Go (Golang WhatsApp Engine) ===\n');

// 1. Instanciação e Verificação de Configuração
console.log('1. Validando inicialização e detecção de ambiente...');
const clientDefault = new EvolutionGoClient();
assert.equal(typeof clientDefault.isConfigured, 'function');
assert.equal(clientDefault.baseUrl.endsWith('/'), false, 'Base URL não deve terminar com barra.');

const clientConfigured = new EvolutionGoClient({
  baseUrl: 'http://127.0.0.1:8085/',
  apiKey: 'test-key-123'
});
assert.equal(clientConfigured.isConfigured(), true, 'Client deve ser reconhecido como configurado.');
assert.equal(clientConfigured.baseUrl, 'http://127.0.0.1:8085', 'Trailing slash deve ser removido.');
console.log('   ✓ Inicialização e saneamento de URL validados.');

// 2. Normalização de Nomes de Instância e Telefones
console.log('\n2. Validando normalização de instâncias e números telefônicos...');
assert.equal(clientDefault.cleanInstanceName('Angelim Construtora'), 'angelim_construtora');
assert.equal(clientDefault.cleanInstanceName('tenant-123!@#$'), 'tenant-123');
assert.equal(clientDefault.cleanInstanceName(''), 'public');

// Números BR
assert.equal(clientDefault.normalizePhoneNumber('(95) 99136-3678'), '5595991363678');
assert.equal(clientDefault.normalizePhoneNumber('5595991363678'), '5595991363678');
assert.equal(clientDefault.normalizePhoneNumber('+55 (11) 98765-4321'), '5511987654321');
assert.equal(clientDefault.normalizePhoneNumber(''), '');
console.log('   ✓ Limpeza de instâncias e normalização de telefones BR validadas.');

// 3. Fallback Seguro quando Servidor Evolution Go estiver Inacessível
console.log('\n3. Validando fail-safe e timeout quando o serviço estiver offline...');
const clientOffline = new EvolutionGoClient({
  baseUrl: 'http://127.0.0.1:59999', // Porta não utilizada
  apiKey: 'secret',
  timeoutMs: 500
});

const offlineRes = await clientOffline.sendTextMessage('test-tenant', '95991363678', 'Olá teste');
assert.equal(offlineRes.ok, false);
assert.equal(offlineRes.status, 502);
assert.match(offlineRes.error, /Falha de rede no Evolution Go/);
console.log('   ✓ Fail-safe e tratamento de erro de rede validados.');

// 4. Integridade de Contratos do Backend e Compatibilidade
console.log('\n4. Validando integridade de código e segurança em backend/server.js...');
const serverCode = fs.readFileSync('backend/server.js', 'utf8');

assert.equal(serverCode.includes("import { evolutionGo } from './evolution_client.js';"), true, 'server.js deve importar o conector evolutionGo.');
assert.equal(serverCode.includes("express.json({ limit: '12mb' })"), true, 'server.js deve manter limite de 12mb.');
assert.equal(serverCode.includes("const destPhone = String(phone || '').replace(/\\D/g, '');"), true, 'server.js deve sanitizar destPhone.');
assert.equal(serverCode.includes("MAX_MEDIA_BYTES = 8 * 1024 * 1024"), true, 'server.js deve limitar mídia a 8 MB.');
assert.equal(serverCode.includes("forbiddenMime"), true, 'server.js deve bloquear MIME perigoso.');
assert.equal(serverCode.includes("evolutionGo.isConfigured()"), true, 'server.js deve verificar isConfigured() antes de delegar.');
assert.equal(serverCode.includes("evolutionGo.getUnifiedSessionSummary"), true, 'server.js deve consultar sessão unificada.');
console.log('   ✓ Todos os invariantes de segurança e delegação do backend foram confirmados.');

// 5. Verificação dos Arquivos de Orquestração Docker
console.log('\n5. Validando arquivos de configuração Docker e variáveis...');
assert.equal(fs.existsSync('docker-compose.evolution-go.yml'), true, 'docker-compose.evolution-go.yml deve existir.');
assert.equal(fs.existsSync('.env.evolution-go.example'), true, '.env.evolution-go.example deve existir.');

const composeContent = fs.readFileSync('docker-compose.evolution-go.yml', 'utf8');
assert.equal(composeContent.includes('evoapicloud/evolution-go:latest'), true, 'Compose deve referenciar a imagem oficial.');
assert.equal(composeContent.includes('POSTGRES_AUTH_DB'), true, 'Compose deve declarar POSTGRES_AUTH_DB.');
assert.equal(composeContent.includes('SERVER_PORT=8080'), true, 'Compose deve expor porta 8080.');
console.log('   ✓ Arquivos Docker Compose e variáveis de ambiente confirmados.');

console.log('\n======================================================');
console.log('🎉 TODOS OS TESTES DO ADAPTADOR EVOLUTION GO PASSARAM!');
console.log('======================================================\n');
