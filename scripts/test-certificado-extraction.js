import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { extractX509FromPfx, parseCertDetails } from '../api/_certificado.js';

console.log('=== Teste de Extração de Certificado A1 (PKCS#12 & Parser ICP-Brasil) ===');

async function run() {
  // 1. Teste de parseCertDetails com padrão ICP-Brasil PJ no CN
  const mockCertCn = {
    subject: 'CN=ANGELIM CONSTRUTORA LTDA:12345678000195,OU=Certificado PJ A1,O=ICP-Brasil,C=BR',
    issuer: 'CN=AC VALID v5,O=VALID,C=BR',
    validFrom: '2026-01-01T00:00:00.000Z',
    validTo: '2027-01-01T23:59:59.000Z',
    serialNumber: '1A2B3C4D5E'
  };
  const d1 = parseCertDetails(mockCertCn);
  assert.strictEqual(d1.cnpj, '12345678000195', 'CNPJ deve ser extraído do CN');
  assert.strictEqual(d1.razaoSocial, 'ANGELIM CONSTRUTORA LTDA', 'Razão social deve ser extraída do CN');
  assert.strictEqual(d1.validoDe, '2026-01-01T00:00:00.000Z');
  assert.strictEqual(d1.validoAte, '2027-01-01T23:59:59.000Z');
  console.log('✅ parseCertDetails: CNPJ e Razão Social via padrão CN="RAZÃO:CNPJ" validados.');

  // 2. Teste de parseCertDetails com OID 2.16.76.1.3.3 no subjectAltName (SAN)
  const mockCertSan = {
    subject: 'CN=CONSTRUTORA EXEMPLO LTDA,OU=Autenticacao,O=ICP-Brasil,C=BR',
    subjectAltName: 'othername: 2.16.76.1.3.3;98765432000188,DNS:empresa.com.br',
    issuer: 'CN=AC SERASA v5,O=SERASA,C=BR',
    validFrom: '2026-03-10T12:00:00.000Z',
    validTo: '2027-03-10T12:00:00.000Z',
    serialNumber: '99887766'
  };
  const d2 = parseCertDetails(mockCertSan);
  assert.strictEqual(d2.cnpj, '98765432000188', 'CNPJ deve ser extraído de subjectAltName com OID 2.16.76.1.3.3');
  assert.strictEqual(d2.razaoSocial, 'CONSTRUTORA EXEMPLO LTDA');
  console.log('✅ parseCertDetails: CNPJ via OID 2.16.76.1.3.3 no SAN validado.');

  // 3. Teste de parseCertDetails com e-CPF (Pessoa Física / MEI)
  const mockCertCpf = {
    subject: 'CN=JOAO DA SILVA:12345678901,O=ICP-Brasil,C=BR',
    issuer: 'CN=AC CERTISIGN v10,O=CERTISIGN,C=BR',
    validFrom: '2026-05-01T00:00:00.000Z',
    validTo: '2027-05-01T00:00:00.000Z'
  };
  const d3 = parseCertDetails(mockCertCpf);
  assert.strictEqual(d3.cnpj, '12345678901', 'CPF deve ser extraído como identificador no fallback');
  assert.strictEqual(d3.razaoSocial, 'JOAO DA SILVA');
  console.log('✅ parseCertDetails: Fallback para e-CPF validado.');

  // 4. Teste de resiliência: buffer inválido ou vazio
  const certVazio = await extractX509FromPfx(Buffer.alloc(0), '123');
  assert.strictEqual(certVazio, null, 'Buffer vazio deve retornar null sem crashar');
  console.log('✅ extractX509FromPfx: Buffer vazio tratado com segurança.');

  // 5. Se houver arquivo de teste em scratch/, executa teste mTLS local
  const pfxPath = path.resolve('scratch/test_cert.pfx');
  if (fs.existsSync(pfxPath)) {
    const pfxBuf = fs.readFileSync(pfxPath);
    const cert = await extractX509FromPfx(pfxBuf, '123456');
    assert(cert, 'Deveria extrair via TLS');
    console.log('✅ Teste com PFX real em scratch/ executado com sucesso.');
  }

  console.log('🎉 Todos os testes de extração e parsing de certificados passaram!');
}

run().catch((err) => {
  console.error('❌ Falha no teste:', err);
  process.exit(1);
});
