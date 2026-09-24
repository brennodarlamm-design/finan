// scripts/test-sefaz-dfe.js — Suíte de Testes Automatizados para o Monitor DF-e SEFAZ (NFe / CTe)
import assert from 'node:assert';
import zlib from 'node:zlib';
import {
  decompressAndParseDocZip,
  parseSefazDistResponse,
  getDFeStatus,
  listarDFeDocumentos
} from '../api/_sefaz-dfe.js';
import { parseCertDetails } from '../api/_certificado.js';

console.log('🧪 Iniciando testes do Monitor DF-e SEFAZ Nativo...\n');

// ── TESTE 1: Prioridade de CNPJ no parseCertDetails ─────────────────────────
console.log('1. Testando parseCertDetails com CN contendo CNPJ e OU contendo chamado/AR...');
const fakeCertWithTicket = {
  subject: 'OU=19943262000118, CN=ANGELIM CONSTRUTORA LTDA:65512273000160',
  issuer: 'AC SOLUTI Multipla v5',
  validFrom: '2026-05-04T21:57:00Z',
  validTo: '2027-05-04T21:57:00Z',
  serialNumber: '2109260504710382'
};

const details = parseCertDetails(fakeCertWithTicket);
assert.strictEqual(details.cnpj, '65512273000160', 'Deve extrair CNPJ oficial do CN e ignorar ticket em OU');
assert.strictEqual(details.razaoSocial, 'ANGELIM CONSTRUTORA LTDA', 'Deve extrair razão social limpa');
console.log('  ✓ CNPJ prioritário extraído com sucesso:', details.cnpj);

// ── TESTE 2: Parse da resposta SOAP da SEFAZ (cStat, NSU, docZip) ───────────
console.log('\n2. Testando parseSefazDistResponse...');
const fakeSoapResponse = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>
    <nfeDistDFeInteresseResponse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDistDFeInteresseResult>
        <retDistDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe">
          <tpAmb>1</tpAmb>
          <cStat>138</cStat>
          <xMotivo>Documento localizado para o NSU informado</xMotivo>
          <dhResp>2026-09-23T21:40:00-03:00</dhResp>
          <ultNSU>000000000000045</ultNSU>
          <maxNSU>000000000000050</maxNSU>
          <loteDistDFeInt>
            <docZip NSU="000000000000044" schema="resNFe_v1.01.xsd">SGVsbG8gV29ybGQ=</docZip>
            <docZip NSU="000000000000045" schema="procNFe_v4.00.xsd">U0VGQVogVGVzdA==</docZip>
          </loteDistDFeInt>
        </retDistDFeInt>
      </nfeDistDFeInteresseResult>
    </nfeDistDFeInteresseResponse>
  </soap:Body>
</soap:Envelope>`;

const parsedSoap = parseSefazDistResponse(fakeSoapResponse);
assert.strictEqual(parsedSoap.cStat, '138', 'cStat deve ser 138');
assert.strictEqual(parsedSoap.ultNSU, '000000000000045', 'ultNSU deve ter 15 dígitos');
assert.strictEqual(parsedSoap.maxNSU, '000000000000050', 'maxNSU deve ter 15 dígitos');
assert.strictEqual(parsedSoap.docZipList.length, 2, 'Deve identificar 2 itens no docZipList');
assert.strictEqual(parsedSoap.docZipList[0].nsu, '000000000000044');
assert.strictEqual(parsedSoap.docZipList[0].schema, 'resNFe_v1.01.xsd');
console.log('  ✓ Resposta SOAP e lista de docZip extraídos com sucesso.');

// ── TESTE 3: Descompactação GZIP e interpretação de resNFe ──────────────────
console.log('\n3. Testando decompressAndParseDocZip com resNFe...');
const xmlResNfe = `<?xml version="1.0" encoding="utf-8"?>
<resNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
  <chNFe>14260965512273000160550010000012341000012345</chNFe>
  <CNPJ>12345678000199</CNPJ>
  <xNome>FORNECEDOR DE MATERIAIS DE CONSTRUCAO LTDA</xNome>
  <IE>123456789</IE>
  <dhEmi>2026-09-20T10:30:00-03:00</dhEmi>
  <tpNF>1</tpNF>
  <vNF>15840.50</vNF>
  <digVal>ABC123XYZ456=</digVal>
  <dhRecbto>2026-09-20T10:32:00-03:00</dhRecbto>
  <cSitNFe>1</cSitNFe>
</resNFe>`;

const gzippedResNfe = zlib.gzipSync(Buffer.from(xmlResNfe, 'utf8')).toString('base64');
const parsedDoc = decompressAndParseDocZip({
  nsu: '000000000000044',
  schema: 'resNFe_v1.01.xsd',
  base64Content: gzippedResNfe
});

assert.strictEqual(parsedDoc.sucesso, true, 'Deve descompactar com sucesso');
assert.strictEqual(parsedDoc.tipoDocumento, 'NFE', 'Tipo deve ser NFE');
assert.strictEqual(parsedDoc.chave, '14260965512273000160550010000012341000012345');
assert.strictEqual(parsedDoc.cnpjEmitente, '12345678000199');
assert.strictEqual(parsedDoc.nomeEmitente, 'FORNECEDOR DE MATERIAIS DE CONSTRUCAO LTDA');
assert.strictEqual(parsedDoc.valorTotal, 15840.50);
assert.strictEqual(parsedDoc.situacao, 'autorizada');
console.log('  ✓ resNFe descompactado e parseado com sucesso:', {
  chave: parsedDoc.chave,
  valor: parsedDoc.valorTotal,
  emitente: parsedDoc.nomeEmitente
});

// ── TESTE 4: Descompactação GZIP e interpretação de resCTe ──────────────────
console.log('\n4. Testando decompressAndParseDocZip com resCTe...');
const xmlResCte = `<?xml version="1.0" encoding="utf-8"?>
<resCTe xmlns="http://www.portalfiscal.inf.br/cte" versao="1.00">
  <chCTe>14260965512273000160570010000004561000000456</chCTe>
  <CNPJ>98765432000188</CNPJ>
  <xNome>TRANSPORTADORA RAPIDA LTDA</xNome>
  <dhEmi>2026-09-22T14:15:00-03:00</dhEmi>
  <vTPrest>2450.00</vTPrest>
  <cSitCTe>1</cSitCTe>
</resCTe>`;

const gzippedResCte = zlib.gzipSync(Buffer.from(xmlResCte, 'utf8')).toString('base64');
const parsedCte = decompressAndParseDocZip({
  nsu: '000000000000045',
  schema: 'resCTe_v1.00.xsd',
  base64Content: gzippedResCte
});

assert.strictEqual(parsedCte.sucesso, true);
assert.strictEqual(parsedCte.tipoDocumento, 'CTE');
assert.strictEqual(parsedCte.chave, '14260965512273000160570010000004561000000456');
assert.strictEqual(parsedCte.valorTotal, 2450.00);
assert.strictEqual(parsedCte.nomeEmitente, 'TRANSPORTADORA RAPIDA LTDA');
console.log('  ✓ resCTe descompactado e parseado com sucesso:', {
  chave: parsedCte.chave,
  valor: parsedCte.valorTotal,
  tipo: parsedCte.tipoDocumento
});

// ── TESTE 5: Descompactação GZIP de resEvento (Cancelamento) ─────────────────
console.log('\n5. Testando decompressAndParseDocZip com resEvento...');
const xmlResEvento = `<?xml version="1.0" encoding="utf-8"?>
<resEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
  <chNFe>14260965512273000160550010000012341000012345</chNFe>
  <CNPJ>12345678000199</CNPJ>
  <tpEvento>110111</tpEvento>
  <descEvento>Cancelamento homologado</descEvento>
  <dhEvento>2026-09-21T16:00:00-03:00</dhEvento>
</resEvento>`;

const gzippedResEvento = zlib.gzipSync(Buffer.from(xmlResEvento, 'utf8')).toString('base64');
const parsedEvento = decompressAndParseDocZip({
  nsu: '000000000000046',
  schema: 'resEvento_v1.01.xsd',
  base64Content: gzippedResEvento
});

assert.strictEqual(parsedEvento.sucesso, true);
assert.strictEqual(parsedEvento.tipoDocumento, 'EVENTO');
assert.strictEqual(parsedEvento.situacao, 'cancelada');
console.log('  ✓ resEvento (Cancelamento) interpretado com sucesso.');

// ── TESTE 6: Consulta de status e listagem com mock de SQL RLS ──────────────
console.log('\n6. Testando getDFeStatus e listarDFeDocumentos...');
const mockSyncData = [{
  tenant_id: 'tenant-test',
  ultimo_nsu: '000000000000037',
  max_nsu: '000000000000050',
  ultima_sincronizacao: new Date().toISOString(),
  proxima_consulta_permitida: null,
  status_sefaz: 'sincronizado',
  mensagem_sefaz: 'Consulta concluída com sucesso',
  total_documentos: 3
}];

const mockCertData = [{
  cnpj: '65512273000160',
  razao_social: 'ANGELIM CONSTRUTORA LTDA',
  valido_ate: '2027-05-04T21:57:00Z',
  status: 'ativo'
}];

const mockCounts = [
  { tipo_documento: 'NFE', qtd: '2' },
  { tipo_documento: 'CTE', qtd: '1' }
];

let queryIdx = 0;
const mockSql = async (strings, ...values) => {
  const q = Array.isArray(strings) ? strings.join('?') : String(strings);
  if (q.includes('FROM tenant_dfe_sync')) return mockSyncData;
  if (q.includes('FROM tenant_certificates')) return mockCertData;
  if (q.includes('GROUP BY tipo_documento')) return mockCounts;
  if (q.includes('FROM tenant_dfe_documentos')) {
    return [
      { id: '1', tipo_documento: 'NFE', chave: 'chave-1', valor_total: 100, tem_xml: true },
      { id: '2', tipo_documento: 'CTE', chave: 'chave-2', valor_total: 200, tem_xml: true }
    ];
  }
  return [];
};

const statusRes = await getDFeStatus(mockSql, 'tenant-test');
assert.strictEqual(statusRes.success, true);
assert.strictEqual(statusRes.totais.NFE, 2);
assert.strictEqual(statusRes.totais.CTE, 1);
assert.strictEqual(statusRes.totalGeral, 3);
assert.strictEqual(statusRes.sync.ultimo_nsu, '000000000000037');
console.log('  ✓ getDFeStatus consolidado:', statusRes.totais);

const listRes = await listarDFeDocumentos(mockSql, 'tenant-test', { limit: 10 });
assert.strictEqual(listRes.success, true);
assert.strictEqual(listRes.documentos.length, 2);
console.log('  ✓ listarDFeDocumentos retornou documentos com sucesso.');

console.log('\n🎉 TODOS OS TESTES DO MONITOR DF-E PASSARAM COM SUCESSO!\n');
