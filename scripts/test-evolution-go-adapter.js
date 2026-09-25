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

// 5. Testes do Interpretador de Webhooks (parseWebhookPayload)
console.log('\n5. Validando interpretação e normalização de webhooks do Evolution Go...');
// 5.1 QR Code
const qrPayload = {
  event: 'qrcode.updated',
  instance: 'construtora_alfa',
  data: {
    qrcode: 'test-raw-qr-code-string',
    base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  }
};
const parsedQr = clientDefault.parseWebhookPayload(qrPayload);
assert.equal(parsedQr.type, 'qrcode');
assert.equal(parsedQr.tenantId, 'construtora_alfa');
assert.match(parsedQr.qrDataUrl, /^data:image\/png;base64,/);

// 5.2 Conexão (Open / Close)
const connOpenPayload = {
  event: 'connection.update',
  instance: 'tenant-99',
  data: {
    state: 'open',
    number: '5595991363678'
  }
};
const parsedOpen = clientDefault.parseWebhookPayload(connOpenPayload);
assert.equal(parsedOpen.type, 'connection');
assert.equal(parsedOpen.connected, true);
assert.equal(parsedOpen.status, 'connected');
assert.equal(parsedOpen.number, '5595991363678');

const connClosePayload = {
  event: 'connection.update',
  instance: 'tenant-99',
  data: {
    state: 'close',
    statusReason: 401
  }
};
const parsedClose = clientDefault.parseWebhookPayload(connClosePayload);
assert.equal(parsedClose.type, 'connection');
assert.equal(parsedClose.connected, false);
assert.equal(parsedClose.status, 'disconnected');

// 5.3 Mensagem Recebida (Messages Upsert)
const msgPayload = {
  event: 'messages.upsert',
  instance: 'tenant-99',
  data: {
    key: {
      remoteJid: '5595988887777@s.whatsapp.net',
      fromMe: false,
      id: 'MSG-001'
    },
    pushName: 'Engenheiro Carlos',
    message: {
      conversation: 'Relatório da concretagem enviado.'
    },
    messageTimestamp: 1727274000
  }
};
const parsedMsg = clientDefault.parseWebhookPayload(msgPayload);
assert.equal(parsedMsg.type, 'message');
assert.equal(parsedMsg.tenantId, 'tenant-99');
assert.equal(parsedMsg.phone, '5595988887777');
assert.equal(parsedMsg.pushName, 'Engenheiro Carlos');
assert.equal(parsedMsg.isFromMe, false);
assert.equal(parsedMsg.text, 'Relatório da concretagem enviado.');
assert.equal(parsedMsg.hasMedia, false);

console.log('   ✓ Normalização de QR Code, Conexão e Mensagens do webhook validadas.');

// 6. Verificação de Rotas Webhook no Servidor e Proxy
console.log('\n6. Validando rotas de webhook em backend/server.js e api/whatsapp.js...');
const apiWaCode = fs.readFileSync('api/whatsapp.js', 'utf8');

assert.equal(serverCode.includes("app.post(['/webhook/evolution-go', '/api/webhook-whatsapp']"), true, 'server.js deve expor rota de webhook do Evolution Go.');
assert.equal(serverCode.includes("evolutionGo.parseWebhookPayload(req.body)"), true, 'server.js deve usar parseWebhookPayload no endpoint de webhook.');
assert.equal(apiWaCode.includes("incomingAction === 'webhook'"), true, 'api/whatsapp.js deve interceptar e rotear webhooks.');
assert.equal(apiWaCode.includes("/webhook/evolution-go"), true, 'api/whatsapp.js deve encaminhar eventos para o backend.');
console.log('   ✓ Rotas de webhook do servidor e proxy confirmadas.');

// 7. Verificação dos Arquivos de Orquestração Docker
console.log('\n7. Validando arquivos de configuração Docker e variáveis...');
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
