import fs from 'fs';
import { execFileSync } from 'node:child_process';

function assert(cond, msg) {
  if (!cond) {
    console.error('❌ ' + msg);
    process.exit(1);
  }
  console.log('✅ ' + msg);
}

const monitor = fs.readFileSync('monitor-nfe/MonitorNFe.ps1', 'utf8');
const alert = fs.readFileSync('monitor-nfe/AlertaBoletosWhatsApp.ps1', 'utf8');
const cfg = fs.readFileSync('monitor-nfe/config.example.json', 'utf8');
const readme = fs.readFileSync('monitor-nfe/README.md', 'utf8');
const ignore = fs.readFileSync('.gitignore', 'utf8');
const render = fs.readFileSync('render.yaml', 'utf8');

const tracked = execFileSync('git', ['ls-files', '--', 'monitor-nfe'], { encoding:'utf8' }).split(/\r?\n/);
assert(!tracked.some(file => file.startsWith('monitor-nfe/whatsapp-server/')), 'Servidor local whatsapp-web.js obsoleto não está versionado.');
assert(!tracked.some(file => file.startsWith('monitor-nfe/evolution-api/')), 'Evolution API local obsoleta não está versionada.');
assert(!tracked.includes('monitor-nfe/ultimo_nsu.txt'), 'Estado runtime ultimo_nsu.txt não permanece versionado.');
assert(ignore.includes('monitor-nfe/ultimo_nsu.txt'), 'Estado NSU local está protegido pelo .gitignore.');

assert(monitor.includes('System.Net.Http.HttpClientHandler'), 'SEFAZ usa HttpClient com certificado cliente.');
assert(monitor.includes('ClientCertificates.Add($cert)'), 'Certificado A1 é anexado diretamente ao cliente mTLS.');
assert(!monitor.includes('curl.exe') && !monitor.includes('"-k"') && !monitor.includes('--cert'), 'Monitor não desabilita TLS nem expõe senha do PFX via curl.');
assert(!monitor.includes('X509KeyStorageFlags]::Exportable'), 'Chave privada do certificado não é marcada como exportável.');
assert(monitor.includes('DtdProcessing]::Prohibit') && monitor.includes('XmlResolver = $null'), 'Parser XML proíbe DTD e resolução externa.');
assert(monitor.includes('FINOBRA_CERT_PASSWORD') && monitor.includes('MEUDANFE_API_KEY'), 'Segredos sensíveis aceitam variáveis de ambiente.');
assert(monitor.includes('Timeout = [TimeSpan]::FromSeconds(60)') && monitor.includes('-TimeoutSec 30'), 'Chamadas externas críticas possuem timeout explícito.');
assert(!monitor.includes('Resposta: $respXml'), 'Resposta SOAP bruta não é gravada em log de erro.');

assert(alert.includes('FINOBRA_API_SECRET'), 'Job financeiro prefere segredo do ambiente.');
assert(alert.includes('"x-tenant-id"') && alert.includes('"x-api-key"'), 'Job financeiro envia autenticação interna com escopo de tenant.');
assert(alert.includes('$cfg.empresa.tenant_id'), 'Tenant do job vem da configuração explícita da empresa.');
assert(cfg.includes('"tenant_id": "SEU_TENANT_ID_FINOBRA_AQUI"'), 'Configuração modelo exige tenant_id explícito.');
assert(/não é publicado no Render/i.test(readme) && /não é necessário executar um servidor WhatsApp local/i.test(readme), 'Documentação deixa clara a separação entre utilitário local e produção.');
assert(/rootDir:\s*backend/.test(render), 'Render continua restrito ao backend de produção.');

console.log('\n✅ Monitor NF-e: segurança, isolamento de tenant e arquitetura validados.');
