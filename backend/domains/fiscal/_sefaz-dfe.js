// api/_sefaz-dfe.js — Motor de Distribuição DF-e da SEFAZ (NFe e CTe) Multi-Tenant
// Conexão mTLS direta com SEFAZ Nacional via certificado A1 RFC 7292

import https from 'node:https';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { decryptCertData, extrairChaveECertificadoDoPfx } from './_certificado.js';

// Mapeamento de UFs brasileiras para código IBGE
const UF_IBGE_MAP = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27',
  SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41',
  SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53'
};

/**
 * Monta o Envelope SOAP 1.2 para NFeDistribuicaoDFe
 */
function buildSoapNFeDist(cnpj, codUf, ultNsu) {
  const nsuFormatado = String(ultNsu || '0').padStart(15, '0');
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>1</tpAmb>
          <cUFAutor>${codUf || '91'}</cUFAutor>
          <CNPJ>${cnpj}</CNPJ>
          <distNSU>
            <ultNSU>${nsuFormatado}</ultNSU>
          </distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;
}

/**
 * Monta o Envelope SOAP 1.2 para CTeDistribuicaoDFe
 */
function buildSoapCTeDist(cnpj, codUf, ultNsu) {
  const nsuFormatado = String(ultNsu || '0').padStart(15, '0');
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <cteDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe">
      <cteDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/cte" versao="1.00">
          <tpAmb>1</tpAmb>
          <cUFAutor>${codUf || '91'}</cUFAutor>
          <CNPJ>${cnpj}</CNPJ>
          <distNSU>
            <ultNSU>${nsuFormatado}</ultNSU>
          </distNSU>
        </distDFeInt>
      </cteDadosMsg>
    </cteDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;
}

/**
 * Executa requisição HTTPS SOAP com mTLS à SEFAZ
 */
export function callSefazHttps({ pfxBuffer, passphrase, hostname, path, actionHeader, soapBody, timeout = 30000 }) {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({
      pfx: pfxBuffer,
      passphrase: passphrase,
      rejectUnauthorized: false
    });

    const options = {
      hostname: hostname,
      port: 443,
      path: path,
      method: 'POST',
      agent: agent,
      headers: {
        'Content-Type': `application/soap+xml; charset=utf-8; action="${actionHeader}"`,
        'Content-Length': Buffer.byteLength(soapBody)
      },
      timeout: timeout
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error(`Timeout de ${timeout}ms excedido na comunicação com a SEFAZ (${hostname}).`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(soapBody);
    req.end();
  });
}

// ── Manifestação do destinatário: Ciência da Operação (evento 210210) ─────────────────────────
// Sem a ciência, o DF-e só entrega o resumo da NF-e (<resNFe>: sem produtos nem duplicatas). Com
// ela, a SEFAZ libera o XML completo (procNFe) para o CNPJ da empresa, sem custo. A ciência só
// registra que a empresa tomou conhecimento da nota; não confirma nem recusa a operação.

const NS_NFE = 'http://www.portalfiscal.inf.br/nfe';
const NS_DSIG = 'http://www.w3.org/2000/09/xmldsig#';
const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';

/** dhEvento no horário de Brasília (um minuto atrás, para não cair "no futuro" na SEFAZ). */
export function dhEventoBrasilia(now = new Date()) {
  return new Date(now.getTime() - 3 * 3600000 - 60000).toISOString().slice(0, 19) + '-03:00';
}

/**
 * Monta o <infEvento> da ciência. O XML é gerado sem espaços, comentários nem caracteres que
 * precisem de escape, então a forma canônica (C14N) é ele mesmo com o namespace herdado explícito.
 */
export function montarInfEventoCiencia({ cnpj, chave, dhEvento, nSeqEvento = 1, tpAmb = 1 }) {
  const id = `ID210210${chave}${String(nSeqEvento).padStart(2, '0')}`;
  const corpo = `<cOrgao>91</cOrgao><tpAmb>${tpAmb}</tpAmb><CNPJ>${cnpj}</CNPJ><chNFe>${chave}</chNFe>`
    + `<dhEvento>${dhEvento}</dhEvento><tpEvento>210210</tpEvento><nSeqEvento>${nSeqEvento}</nSeqEvento>`
    + `<verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Ciencia da Operacao</descEvento></detEvento>`;
  return {
    id,
    xml: `<infEvento Id="${id}">${corpo}</infEvento>`,
    canonico: `<infEvento xmlns="${NS_NFE}" Id="${id}">${corpo}</infEvento>`
  };
}

/** Assinatura XMLDSig (enveloped, C14N, RSA-SHA1) exigida pela SEFAZ para eventos da NF-e. */
export function assinarInfEvento({ id, canonico }, privateKey, certDer) {
  const digest = crypto.createHash('sha1').update(canonico, 'utf8').digest('base64');
  const signedInfoCorpo = `<CanonicalizationMethod Algorithm="${C14N}"></CanonicalizationMethod>`
    + `<SignatureMethod Algorithm="${NS_DSIG}rsa-sha1"></SignatureMethod>`
    + `<Reference URI="#${id}"><Transforms><Transform Algorithm="${NS_DSIG}enveloped-signature"></Transform>`
    + `<Transform Algorithm="${C14N}"></Transform></Transforms>`
    + `<DigestMethod Algorithm="${NS_DSIG}sha1"></DigestMethod><DigestValue>${digest}</DigestValue></Reference>`;
  const signedInfoCanonico = `<SignedInfo xmlns="${NS_DSIG}">${signedInfoCorpo}</SignedInfo>`;
  const assinatura = crypto.sign('sha1', Buffer.from(signedInfoCanonico, 'utf8'), privateKey).toString('base64');
  return `<Signature xmlns="${NS_DSIG}"><SignedInfo>${signedInfoCorpo}</SignedInfo>`
    + `<SignatureValue>${assinatura}</SignatureValue>`
    + `<KeyInfo><X509Data><X509Certificate>${Buffer.from(certDer).toString('base64')}</X509Certificate></X509Data></KeyInfo></Signature>`;
}

export function montarEnvEventoCiencia({ cnpj, chave, privateKey, certDer, now = new Date(), idLote = Date.now() }) {
  const inf = montarInfEventoCiencia({ cnpj, chave, dhEvento: dhEventoBrasilia(now) });
  const assinatura = assinarInfEvento(inf, privateKey, certDer);
  return `<envEvento xmlns="${NS_NFE}" versao="1.00"><idLote>${String(idLote).slice(-15)}</idLote>`
    + `<evento xmlns="${NS_NFE}" versao="1.00">${inf.xml}${assinatura}</evento></envEvento>`;
}

/** Lê o retorno do NFeRecepcaoEvento4: o cStat que interessa é o do evento (retEvento). */
export function interpretarRetornoEvento(soapResp) {
  const ret = String(soapResp || '').match(/<retEvento[\s\S]*?<\/retEvento>/i)?.[0] || '';
  const cStat = extractTagValue(ret, 'cStat') || extractTagValue(soapResp || '', 'cStat');
  const xMotivo = extractTagValue(ret, 'xMotivo') || extractTagValue(soapResp || '', 'xMotivo');
  // 135 registrado e vinculado; 136 registrado sem vínculo; 573 duplicidade (já havia ciência).
  return { ok: ['135', '136', '573'].includes(cStat), cStat, xMotivo };
}

export async function enviarCienciaOperacao({ pfxBuffer, passphrase, cnpj, chave, chaveAssinatura, now }) {
  const { privateKey, certDer } = chaveAssinatura || extrairChaveECertificadoDoPfx(pfxBuffer, passphrase);
  const envEvento = montarEnvEventoCiencia({ cnpj, chave, privateKey, certDer, now });
  const soapBody = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">${envEvento}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
  const resp = await callSefazHttps({
    pfxBuffer,
    passphrase,
    hostname: 'www.nfe.fazenda.gov.br',
    path: '/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
    actionHeader: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento',
    soapBody
  });
  return interpretarRetornoEvento(resp.body);
}

/** Consulta uma NF-e específica no DF-e pela chave (consChNFe). */
export async function consultarNFePorChave({ pfxBuffer, passphrase, cnpj, codUf, chave }) {
  const soapBody = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg><distDFeInt xmlns="${NS_NFE}" versao="1.01"><tpAmb>1</tpAmb><cUFAutor>${codUf || '91'}</cUFAutor><CNPJ>${cnpj}</CNPJ><consChNFe><chNFe>${chave}</chNFe></consChNFe></distDFeInt></nfeDadosMsg></nfeDistDFeInteresse></soap12:Body></soap12:Envelope>`;
  const resp = await callSefazHttps({
    pfxBuffer,
    passphrase,
    hostname: 'www1.nfe.fazenda.gov.br',
    path: '/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
    actionHeader: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse',
    soapBody
  });
  return parseSefazDistResponse(resp.body);
}

/**
 * Extrai campos de uma tag XML de forma simples e segura
 */
function extractTagValue(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? match[1].trim() : null;
}

/**
 * Descompacta e interpreta um documento individual docZip
 */
export function decompressAndParseDocZip({ nsu, schema, base64Content }) {
  try {
    const buf = Buffer.from(base64Content.replace(/\s+/g, ''), 'base64');
    const xml = zlib.gunzipSync(buf).toString('utf8');

    let tipo = 'NFE';
    let chave = null;
    let cnpjEmitente = null;
    let nomeEmitente = null;
    let valorTotal = 0;
    let dataEmissao = null;
    let situacao = 'autorizada';
    let schemaTipo = schema || 'desconhecido';

    // 1. Resumo de NF-e (resNFe)
    if (xml.includes('<resNFe') || (schema && schema.includes('resNFe'))) {
      tipo = 'NFE';
      schemaTipo = schema || 'resNFe_v1.01.xsd';
      chave = extractTagValue(xml, 'chNFe');
      cnpjEmitente = extractTagValue(xml, 'CNPJ') || extractTagValue(xml, 'CPF');
      nomeEmitente = extractTagValue(xml, 'xNome');
      const vNF = extractTagValue(xml, 'vNF');
      if (vNF) valorTotal = parseFloat(vNF) || 0;
      dataEmissao = extractTagValue(xml, 'dhEmi');
      const cSit = extractTagValue(xml, 'cSitNFe');
      if (cSit === '2') situacao = 'denegada';
      else if (cSit === '3') situacao = 'cancelada';
      else situacao = 'autorizada';
    }
    // 2. NF-e Completa Processada (nfeProc / NFe)
    else if (xml.includes('<nfeProc') || xml.includes('<NFe')) {
      tipo = 'NFE';
      schemaTipo = schema || 'procNFe_v4.00.xsd';
      chave = extractTagValue(xml, 'chNFe');
      if (!chave) {
        const infMatch = xml.match(/<infNFe[^>]+Id="NFe(\d{44})"/i);
        if (infMatch) chave = infMatch[1];
      }
      const emitMatch = xml.match(/<emit>([\s\S]*?)<\/emit>/i);
      if (emitMatch) {
        cnpjEmitente = extractTagValue(emitMatch[1], 'CNPJ') || extractTagValue(emitMatch[1], 'CPF');
        nomeEmitente = extractTagValue(emitMatch[1], 'xNome');
      }
      const totalMatch = xml.match(/<ICMSTot>([\s\S]*?)<\/ICMSTot>/i);
      if (totalMatch) {
        const vNF = extractTagValue(totalMatch[1], 'vNF');
        if (vNF) valorTotal = parseFloat(vNF) || 0;
      } else {
        const vNF = extractTagValue(xml, 'vNF');
        if (vNF) valorTotal = parseFloat(vNF) || 0;
      }
      dataEmissao = extractTagValue(xml, 'dhEmi') || extractTagValue(xml, 'dEmi');
      situacao = 'autorizada';
    }
    // 3. Resumo de CT-e (resCTe)
    else if (xml.includes('<resCTe') || (schema && schema.includes('resCTe'))) {
      tipo = 'CTE';
      schemaTipo = schema || 'resCTe_v1.00.xsd';
      chave = extractTagValue(xml, 'chCTe');
      cnpjEmitente = extractTagValue(xml, 'CNPJ') || extractTagValue(xml, 'CPF');
      nomeEmitente = extractTagValue(xml, 'xNome');
      const vPrest = extractTagValue(xml, 'vTPrest') || extractTagValue(xml, 'vRec');
      if (vPrest) valorTotal = parseFloat(vPrest) || 0;
      dataEmissao = extractTagValue(xml, 'dhEmi');
      const cSit = extractTagValue(xml, 'cSitCTe');
      situacao = (cSit === '2') ? 'cancelada' : 'autorizada';
    }
    // 4. CT-e Completo Processado (cteProc / CTe)
    else if (xml.includes('<cteProc') || xml.includes('<CTe')) {
      tipo = 'CTE';
      schemaTipo = schema || 'procCTe_v3.00.xsd';
      chave = extractTagValue(xml, 'chCTe');
      if (!chave) {
        const infMatch = xml.match(/<infCte[^>]+Id="CTe(\d{44})"/i);
        if (infMatch) chave = infMatch[1];
      }
      const emitMatch = xml.match(/<emit>([\s\S]*?)<\/emit>/i);
      if (emitMatch) {
        cnpjEmitente = extractTagValue(emitMatch[1], 'CNPJ') || extractTagValue(emitMatch[1], 'CPF');
        nomeEmitente = extractTagValue(emitMatch[1], 'xNome');
      }
      const vPrest = extractTagValue(xml, 'vTPrest');
      if (vPrest) valorTotal = parseFloat(vPrest) || 0;
      dataEmissao = extractTagValue(xml, 'dhEmi');
      situacao = 'autorizada';
    }
    // 5. Eventos da NF-e / CT-e (Cancelamento, Carta de Correção, Confirmação)
    else if (xml.includes('<resEvento') || xml.includes('<procEventoNFe') || xml.includes('<procEventoCTe')) {
      tipo = 'EVENTO';
      schemaTipo = schema || 'resEvento_v1.01.xsd';
      chave = extractTagValue(xml, 'chNFe') || extractTagValue(xml, 'chCTe');
      cnpjEmitente = extractTagValue(xml, 'CNPJ') || extractTagValue(xml, 'CPF');
      const tpEvento = extractTagValue(xml, 'tpEvento');
      const descEvento = extractTagValue(xml, 'descEvento') || 'Evento Fiscal';
      nomeEmitente = descEvento;
      dataEmissao = extractTagValue(xml, 'dhEvento') || extractTagValue(xml, 'dhRegEvento');
      if (tpEvento === '110111') situacao = 'cancelada';
      else situacao = 'evento_registrado';
    }

    if (!chave) {
      // Fallback: busca qualquer sequência de 44 dígitos no XML
      const keyMatch = xml.match(/(?<!\d)(\d{44})(?!\d)/);
      if (keyMatch) chave = keyMatch[1];
    }

    let dataEmissaoIso = null;
    if (dataEmissao) {
      const d = new Date(dataEmissao);
      dataEmissaoIso = isNaN(d.getTime()) ? null : d.toISOString();
    }

    return {
      sucesso: true,
      nsu: String(nsu || '').padStart(15, '0'),
      chave: chave || null,
      tipoDocumento: tipo,
      cnpjEmitente: cnpjEmitente ? cnpjEmitente.replace(/\D/g, '') : null,
      nomeEmitente: nomeEmitente || null,
      valorTotal: valorTotal || 0,
      dataEmissao: dataEmissaoIso,
      situacao: situacao,
      schemaTipo: schemaTipo,
      xml: xml
    };
  } catch (err) {
    console.error(`[DF-e] Erro ao descompactar docZip (NSU ${nsu}):`, err.message);
    return { sucesso: false, erro: 'Documento compactado inválido.', nsu };
  }
}

/**
 * Interpreta a resposta SOAP completa da SEFAZ
 */
export function parseSefazDistResponse(soapResp) {
  const cStat = extractTagValue(soapResp, 'cStat');
  const xMotivo = extractTagValue(soapResp, 'xMotivo');
  const dhResp = extractTagValue(soapResp, 'dhResp');
  const ultNsu = extractTagValue(soapResp, 'ultNSU');
  const maxNsu = extractTagValue(soapResp, 'maxNSU');

  const docZipList = [];
  const re = /<docZip([^>]*)>([\s\S]*?)<\/docZip>/gi;
  let m;
  while ((m = re.exec(soapResp)) !== null) {
    const attrs = m[1];
    const base64Content = m[2].trim();
    const nsuMatch = attrs.match(/NSU="([^"]+)"/i);
    const schemaMatch = attrs.match(/schema="([^"]+)"/i);
    const nsu = nsuMatch ? nsuMatch[1] : '';
    const schema = schemaMatch ? schemaMatch[1] : '';
    docZipList.push({ nsu, schema, base64Content });
  }

  return {
    cStat,
    xMotivo,
    dhResp,
    ultNSU: ultNsu ? String(ultNsu).padStart(15, '0') : null,
    maxNSU: maxNsu ? String(maxNsu).padStart(15, '0') : null,
    docZipList
  };
}

/**
 * Consulta a SEFAZ para NFe ou CTe
 */
export async function consultarSefaz({ pfxBuffer, passphrase, cnpj, codUf, ultNsu, tipo = 'NFE' }) {
  if (tipo === 'CTE') {
    const soapBody = buildSoapCTeDist(cnpj, codUf, ultNsu);
    const resp = await callSefazHttps({
      pfxBuffer,
      passphrase,
      hostname: 'www1.cte.fazenda.gov.br',
      path: '/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx',
      actionHeader: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe/cteDistDFeInteresse',
      soapBody
    });
    return parseSefazDistResponse(resp.body);
  } else {
    const soapBody = buildSoapNFeDist(cnpj, codUf, ultNsu);
    const resp = await callSefazHttps({
      pfxBuffer,
      passphrase,
      hostname: 'www1.nfe.fazenda.gov.br',
      path: '/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
      actionHeader: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse',
      soapBody
    });
    return parseSefazDistResponse(resp.body);
  }
}

/**
 * Orquestrador principal de Sincronização DF-e do Tenant
 * Executa as consultas com anti-flood, persiste os documentos e atualiza o estado de NSU.
 */
/**
 * Grava um documento recebido da SEFAZ (NF-e, CT-e ou evento) em tenant_dfe_documentos.
 * Eventos não sobrescrevem a nota (ver comentário abaixo).
 */
export async function upsertDfeDocumento(sql, tenantId, parsed) {
  const docId = `dfe_${tenantId}_${parsed.chave}`;
  if (parsed.tipoDocumento === 'EVENTO') {
    // Eventos (ciência, carta de correção, cancelamento) usam a mesma chave da NF-e.
    // Antes sobrescreviam a nota: valor 0, emitente = descrição do evento e o XML da
    // NF-e trocado pelo do evento. Agora só o cancelamento altera a situação da nota;
    // se o evento chegar antes da nota, fica um registro provisório que a NF-e substitui.
    await sql`
      INSERT INTO tenant_dfe_documentos (
        id, tenant_id, tipo_documento, nsu, chave, cnpj_emitente,
        nome_emitente, valor_total, data_emissao, situacao,
        schema_tipo, xml_completo, danfe_url, manifesto_status, updated_at
      ) VALUES (
        ${docId}, ${tenantId}, 'EVENTO', ${parsed.nsu}, ${parsed.chave},
        ${parsed.cnpjEmitente}, ${parsed.nomeEmitente}, 0,
        ${parsed.dataEmissao}, ${parsed.situacao}, ${parsed.schemaTipo},
        NULL, NULL, 'sem_manifesto', NOW()
      )
      ON CONFLICT (tenant_id, chave) DO UPDATE SET
        situacao = CASE WHEN ${parsed.situacao} = 'cancelada' THEN 'cancelada' ELSE tenant_dfe_documentos.situacao END,
        updated_at = NOW();
    `;
    return;
  }
  await sql`
    INSERT INTO tenant_dfe_documentos (
      id, tenant_id, tipo_documento, nsu, chave, cnpj_emitente,
      nome_emitente, valor_total, data_emissao, situacao,
      schema_tipo, xml_completo, danfe_url, manifesto_status, updated_at
    ) VALUES (
      ${docId}, ${tenantId}, ${parsed.tipoDocumento}, ${parsed.nsu}, ${parsed.chave},
      ${parsed.cnpjEmitente}, ${parsed.nomeEmitente}, ${parsed.valorTotal},
      ${parsed.dataEmissao}, ${parsed.situacao}, ${parsed.schemaTipo},
      ${parsed.xml}, NULL, 'sem_manifesto', NOW()
    )
    ON CONFLICT (tenant_id, chave) DO UPDATE SET
      tipo_documento = EXCLUDED.tipo_documento,
      nsu = EXCLUDED.nsu,
      cnpj_emitente = COALESCE(EXCLUDED.cnpj_emitente, tenant_dfe_documentos.cnpj_emitente),
      nome_emitente = COALESCE(EXCLUDED.nome_emitente, tenant_dfe_documentos.nome_emitente),
      valor_total = COALESCE(EXCLUDED.valor_total, tenant_dfe_documentos.valor_total),
      data_emissao = COALESCE(EXCLUDED.data_emissao, tenant_dfe_documentos.data_emissao),
      -- Um cancelamento já registrado não é desfeito pela chegada (atrasada) da própria NF-e.
      situacao = CASE WHEN tenant_dfe_documentos.situacao = 'cancelada' THEN 'cancelada'
                      ELSE COALESCE(EXCLUDED.situacao, tenant_dfe_documentos.situacao) END,
      -- O resumo (resNFe) pode chegar depois do XML completo (procNFe): nunca troca o completo
      -- pelo resumo, que não tem produtos nem duplicatas.
      schema_tipo = CASE WHEN EXCLUDED.schema_tipo ILIKE 'resNFe%' AND tenant_dfe_documentos.schema_tipo ILIKE 'procNFe%'
                         THEN tenant_dfe_documentos.schema_tipo ELSE EXCLUDED.schema_tipo END,
      xml_completo = CASE WHEN EXCLUDED.schema_tipo ILIKE 'resNFe%' AND tenant_dfe_documentos.schema_tipo ILIKE 'procNFe%'
                          THEN tenant_dfe_documentos.xml_completo
                          ELSE COALESCE(EXCLUDED.xml_completo, tenant_dfe_documentos.xml_completo) END,
      updated_at = NOW();
  `;
}

/** Código IBGE da UF (cUFAutor do NFeDistribuicaoDFe). */
export const CODIGO_UF_IBGE = Object.freeze({
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17', MA: '21', PI: '22', CE: '23',
  RN: '24', PB: '25', PE: '26', AL: '27', SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35',
  PR: '41', SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53'
});

export async function syncTenantDFe(sql, tenantId, options = {}) {
  // 1. Carrega ou inicializa o registro de sincronização do tenant
  let syncRows = await sql`
    SELECT tenant_id, ultimo_nsu, max_nsu, ultima_sincronizacao,
           proxima_consulta_permitida, status_sefaz, mensagem_sefaz, total_documentos
    FROM tenant_dfe_sync
    WHERE tenant_id = ${tenantId}
    LIMIT 1;
  `;

  let sync = syncRows[0];
  if (!sync) {
    await sql`
      INSERT INTO tenant_dfe_sync (
        tenant_id, ultimo_nsu, max_nsu, status_sefaz, mensagem_sefaz
      ) VALUES (
        ${tenantId}, '000000000000000', '000000000000000', 'pendente', 'Aguardando primeira sincronização'
      )
      ON CONFLICT (tenant_id) DO NOTHING;
    `;
    syncRows = await sql`
      SELECT tenant_id, ultimo_nsu, max_nsu, ultima_sincronizacao,
             proxima_consulta_permitida, status_sefaz, mensagem_sefaz, total_documentos
      FROM tenant_dfe_sync
      WHERE tenant_id = ${tenantId}
      LIMIT 1;
    `;
    sync = syncRows[0];
  }

  // 2. Proteção Anti-Flood: verificar se há bloqueio ativo de 1 hora
  const now = new Date();
  if (sync?.proxima_consulta_permitida) {
    const proximaData = new Date(sync.proxima_consulta_permitida);
    if (proximaData.getTime() > now.getTime() && !options.force) {
      const minutosRestantes = Math.ceil((proximaData.getTime() - now.getTime()) / 60000);
      return {
        success: true,
        rateLimited: true,
        proximaConsulta: proximaData.toISOString(),
        minutosRestantes,
        message: `Aguarde ${minutosRestantes} minuto(s) para nova consulta na SEFAZ (regra de consumo indevido / cStat 656/137).`
      };
    }
  }

  // AUDITORIA 2026-10-04 #19: trava atômica — uma consulta por vez por empresa e no máximo uma a
  // cada 2 minutos. Duas abas/cliques consultavam o mesmo NSU ao mesmo tempo e a SEFAZ respondia
  // 656 (CNPJ bloqueado por 1 hora).
  if (!options.force) {
    const reserva = await sql`
      UPDATE tenant_dfe_sync
      SET proxima_consulta_permitida = NOW() + INTERVAL '2 minutes', updated_at = NOW()
      WHERE tenant_id = ${tenantId}
        AND (proxima_consulta_permitida IS NULL OR proxima_consulta_permitida <= NOW())
      RETURNING tenant_id;
    `;
    if (!reserva.length) {
      return {
        success: true,
        rateLimited: true,
        minutosRestantes: 2,
        message: 'Já existe uma consulta à SEFAZ em andamento para esta empresa. Aguarde alguns minutos.'
      };
    }
  }

  // 3. Obter certificado digital A1 ativo do tenant
  const certRows = await sql`
    SELECT cert_pfx_base64_enc, iv, auth_tag, cnpj, razao_social, status
    FROM tenant_certificates
    WHERE tenant_id = ${tenantId}
    LIMIT 1;
  `;

  if (!certRows.length || certRows[0].status !== 'ativo') {
    return {
      success: false,
      error: 'Nenhum certificado A1 ativo configurado para esta empresa. Envie seu certificado digital A1 primeiro.'
    };
  }

  const certData = certRows[0];
  let pfxBuffer, passphrase;
  try {
    const dec = decryptCertData(certData.cert_pfx_base64_enc, certData.iv, certData.auth_tag);
    pfxBuffer = Buffer.from(dec.pfx_base64, 'base64');
    passphrase = dec.passphrase;
  } catch (errDec) {
    console.error('[DF-e] Falha ao descriptografar certificado do tenant:', errDec.message);
    return {
      success: false,
      error: 'Não foi possível descriptografar o certificado digital. Reenvie o arquivo PFX.'
    };
  }

  const cnpj = certData.cnpj.replace(/\D/g, '');
  // AUDITORIA 2026-10-04 #19: cUFAutor era sempre 14 (RR). Agora vem da UF cadastrada da empresa.
  let codUf = options.codUf || '';
  if (!codUf) {
    try {
      const t = await sql`SELECT uf FROM tenants WHERE id = ${tenantId} LIMIT 1;`;
      codUf = CODIGO_UF_IBGE[String(t[0]?.uf || '').trim().toUpperCase()] || '';
    } catch { codUf = ''; }
  }
  if (!codUf) codUf = '14'; // sem UF cadastrada: mantém o padrão anterior (RR)
  let ultNsu = sync.ultimo_nsu || '000000000000000';
  let totalProcessados = 0;
  let lastCStat = null;
  let lastMotivo = null;

  // 4. Executa consulta para NF-e (máximo 5 iterações contínuas para não esgotar timeout serverless)
  const maxLotes = options.maxBatches || 5;
  let lote = 0;

  while (lote < maxLotes) {
    lote++;
    console.log(`[DF-e] Consultando SEFAZ NF-e para ${cnpj} (lote ${lote}, ultNSU: ${ultNsu})...`);

    let sefazResult;
    try {
      sefazResult = await consultarSefaz({
        pfxBuffer,
        passphrase,
        cnpj,
        codUf,
        ultNsu,
        tipo: 'NFE'
      });
    } catch (errNet) {
      console.error('[DF-e] Erro de rede ao conectar à SEFAZ:', errNet.message);
      await sql`
        UPDATE tenant_dfe_sync
        SET status_sefaz = 'erro_comunicacao',
            mensagem_sefaz = ${'Falha de comunicação com a SEFAZ. Nova tentativa liberada em 15 minutos.'},
            proxima_consulta_permitida = NOW() + INTERVAL '15 minutes', -- pausa após erro
            updated_at = NOW()
        WHERE tenant_id = ${tenantId};
      `;
      return {
        success: false,
        error: 'Falha ao comunicar com os servidores da SEFAZ. Tente novamente em 15 minutos.'
      };
    }

    lastCStat = sefazResult.cStat;
    lastMotivo = sefazResult.xMotivo;

    // Caso A: Consumo Indevido (656) — SEFAZ impõe cooldown de 1 hora
    if (lastCStat === '656') {
      console.warn(`[DF-e] SEFAZ 656 Consumo Indevido para ${cnpj}: ${lastMotivo}`);
      const novoUltNsu = sefazResult.ultNSU || ultNsu;
      await sql`
        UPDATE tenant_dfe_sync
        SET ultimo_nsu = ${novoUltNsu},
            status_sefaz = 'bloqueado_sefaz',
            mensagem_sefaz = ${lastMotivo || 'Consumo indevido: aguarde 1 hora.'},
            proxima_consulta_permitida = NOW() + INTERVAL '1 hour',
            updated_at = NOW()
        WHERE tenant_id = ${tenantId};
      `;
      return {
        success: true,
        cStat: '656',
        rateLimited: true,
        message: lastMotivo,
        novosDocumentos: totalProcessados,
        proximaConsulta: new Date(Date.now() + 3600000).toISOString()
      };
    }

    // Caso B: Nenhum documento localizado (137)
    if (lastCStat === '137') {
      console.log(`[DF-e] SEFAZ 137 Nenhum documento localizado para ${cnpj}.`);
      const novoUltNsu = sefazResult.ultNSU || ultNsu;
      const novoMaxNsu = sefazResult.maxNSU || sync.max_nsu || novoUltNsu;
      await sql`
        UPDATE tenant_dfe_sync
        SET ultimo_nsu = ${novoUltNsu},
            max_nsu = ${novoMaxNsu},
            ultima_sincronizacao = NOW(),
            status_sefaz = 'sincronizado',
            mensagem_sefaz = ${lastMotivo || 'Nenhum documento localizado.'},
            proxima_consulta_permitida = NOW() + INTERVAL '1 hour',
            updated_at = NOW()
        WHERE tenant_id = ${tenantId};
      `;
      break;
    }

    // Caso C: Documentos localizados (138)
    if (lastCStat === '138') {
      const docs = sefazResult.docZipList || [];
      console.log(`[DF-e] SEFAZ 138: ${docs.length} documento(s) compactado(s) recebidos.`);

      for (const item of docs) {
        const parsed = decompressAndParseDocZip(item);
        if (!parsed.sucesso || !parsed.chave) continue;

        await upsertDfeDocumento(sql, tenantId, parsed);
        totalProcessados++;
      }

      ultNsu = sefazResult.ultNSU || ultNsu;
      const maxNsu = sefazResult.maxNSU || ultNsu;

      await sql`
        UPDATE tenant_dfe_sync
        SET ultimo_nsu = ${ultNsu},
            max_nsu = ${maxNsu},
            ultima_sincronizacao = NOW(),
            status_sefaz = 'sincronizado',
            mensagem_sefaz = ${lastMotivo},
            total_documentos = (SELECT COUNT(*) FROM tenant_dfe_documentos WHERE tenant_id = ${tenantId}),
            updated_at = NOW()
        WHERE tenant_id = ${tenantId};
      `;

      // Se já alcançamos o maxNSU numérico, não há mais lotes
      const nsuAtual = BigInt(String(ultNsu).replace(/\D/g, '') || '0');
      const nsuMax = BigInt(String(maxNsu).replace(/\D/g, '') || '0');
      if (nsuAtual >= nsuMax && nsuMax > 0n) {
        break;
      }

      // Pequena pausa (1.5s) entre lotes para respeitar a infraestrutura da SEFAZ
      await new Promise(r => setTimeout(r, 1500));
    } else {
      // Outro código retornado pela SEFAZ
      console.warn(`[DF-e] SEFAZ retornou cStat inesperado ${lastCStat}: ${lastMotivo}`);
      await sql`
        UPDATE tenant_dfe_sync
        SET status_sefaz = ${'cStat_' + lastCStat},
            mensagem_sefaz = ${lastMotivo},
            proxima_consulta_permitida = NOW() + INTERVAL '15 minutes', -- pausa após resposta inesperada
            updated_at = NOW()
        WHERE tenant_id = ${tenantId};
      `;
      break;
    }
  }

  // 5. Ciência da operação para as NF-e que só vieram em resumo (até 10 por rodada). Com ela a
  // SEFAZ libera o XML completo, que chega numa das próximas sincronizações.
  let ciencias = 0;
  if (options.ciencia !== false) {
    try {
      ciencias = await darCienciaPendentes(sql, tenantId, { pfxBuffer, passphrase, cnpj, limite: 10 });
    } catch (errCiencia) {
      console.warn('[DF-e] Ciência automática não concluída:', errCiencia.message);
    }
  }

  // 6. Retorna o resumo consolidado
  const contagem = await sql`
    SELECT COUNT(*) as count FROM tenant_dfe_documentos WHERE tenant_id = ${tenantId};
  `;

  return {
    success: true,
    cStat: lastCStat,
    mensagem: lastMotivo,
    novosDocumentos: totalProcessados,
    ciencias,
    ultimoNsu: ultNsu,
    totalDocumentos: parseInt(contagem[0]?.count || '0', 10)
  };
}

/** Envia a ciência das NF-e em resumo ainda sem manifestação. Devolve quantas foram registradas. */
export async function darCienciaPendentes(sql, tenantId, { pfxBuffer, passphrase, cnpj, limite = 10, enviar = enviarCienciaOperacao } = {}) {
  const pendentes = await sql`
    SELECT chave FROM tenant_dfe_documentos
    WHERE tenant_id = ${tenantId} AND tipo_documento = 'NFE'
      AND schema_tipo ILIKE 'resNFe%' AND COALESCE(manifesto_status, 'sem_manifesto') = 'sem_manifesto'
      AND COALESCE(situacao, 'autorizada') = 'autorizada'
    ORDER BY data_emissao DESC NULLS LAST
    LIMIT ${limite};
  `;
  if (!pendentes.length) return 0;
  const chaveAssinatura = extrairChaveECertificadoDoPfx(pfxBuffer, passphrase);
  let registradas = 0;
  for (const { chave } of pendentes) {
    let status = 'ciencia_erro';
    try {
      const r = await enviar({ pfxBuffer, passphrase, cnpj, chave, chaveAssinatura });
      if (r.ok) { status = 'ciencia'; registradas++; }
      else console.warn(`[DF-e] Ciência recusada para ...${chave.slice(-6)}: ${r.cStat} ${r.xMotivo || ''}`);
    } catch (err) {
      console.warn(`[DF-e] Falha ao enviar ciência ...${chave.slice(-6)}:`, err.message);
      status = 'sem_manifesto'; // erro de rede: tenta de novo na próxima sincronização
    }
    await sql`UPDATE tenant_dfe_documentos SET manifesto_status = ${status}, updated_at = NOW() WHERE tenant_id = ${tenantId} AND chave = ${chave};`;
  }
  return registradas;
}

async function carregarCertificadoTenant(sql, tenantId) {
  const rows = await sql`SELECT cert_pfx_base64_enc, iv, auth_tag, cnpj, status FROM tenant_certificates WHERE tenant_id = ${tenantId} LIMIT 1;`;
  if (!rows.length || rows[0].status !== 'ativo') throw new Error('Nenhum certificado A1 ativo configurado para esta empresa.');
  const dec = decryptCertData(rows[0].cert_pfx_base64_enc, rows[0].iv, rows[0].auth_tag);
  return { pfxBuffer: Buffer.from(dec.pfx_base64, 'base64'), passphrase: dec.passphrase, cnpj: String(rows[0].cnpj || '').replace(/\D/g, '') };
}

/**
 * XML completo de uma NF-e da empresa, direto da SEFAZ e sem custo: se só existe o resumo, envia a
 * ciência (quando falta) e consulta a nota pela chave (consChNFe). Quando a SEFAZ ainda não liberou
 * o XML completo, devolve o resumo com `pendente: true`.
 */
export async function obterXmlCompletoNFe(sql, tenantId, chave, deps = {}) {
  const ch = String(chave || '').replace(/\D/g, '');
  if (ch.length !== 44) return { success: false, error: 'Chave de acesso inválida.' };
  const lerLinha = async () => (await sql`
    SELECT chave, schema_tipo, xml_completo, manifesto_status FROM tenant_dfe_documentos
    WHERE tenant_id = ${tenantId} AND chave = ${ch} LIMIT 1;`)[0];
  let linha = await lerLinha();
  const completo = (l) => l && l.xml_completo && /<infNFe[\s>]/.test(l.xml_completo);
  if (completo(linha)) return { success: true, completo: true, xml: linha.xml_completo };

  const cert = deps.cert || await carregarCertificadoTenant(sql, tenantId);
  if (linha && COALESCE_STATUS(linha.manifesto_status) !== 'ciencia') {
    await darCienciaParaChave(sql, tenantId, ch, cert, deps.enviar || enviarCienciaOperacao);
  }
  let codUf = '';
  try {
    const t = await sql`SELECT uf FROM tenants WHERE id = ${tenantId} LIMIT 1;`;
    codUf = CODIGO_UF_IBGE[String(t[0]?.uf || '').trim().toUpperCase()] || '';
  } catch {}
  const resp = await (deps.consultar || consultarNFePorChave)({ ...cert, codUf: codUf || '14', chave: ch });
  if (resp.cStat === '138') {
    for (const item of resp.docZipList || []) {
      const parsed = decompressAndParseDocZip(item);
      if (parsed.sucesso && parsed.chave) await upsertDfeDocumento(sql, tenantId, parsed);
    }
    linha = await lerLinha();
    if (completo(linha)) return { success: true, completo: true, xml: linha.xml_completo };
  }
  if (linha?.xml_completo) {
    return { success: true, completo: false, pendente: true, xml: linha.xml_completo, cStat: resp.cStat, mensagem: 'A SEFAZ ainda não liberou o XML completo desta NF-e. Tente de novo em alguns minutos.' };
  }
  return { success: false, cStat: resp.cStat, error: resp.cStat === '137' ? 'NF-e não encontrada na SEFAZ para o CNPJ desta empresa.' : (resp.xMotivo || 'A SEFAZ não devolveu esta NF-e.') };
}

function COALESCE_STATUS(v) { return v || 'sem_manifesto'; }

async function darCienciaParaChave(sql, tenantId, chave, cert, enviar) {
  try {
    const r = await enviar({ ...cert, chave });
    await sql`UPDATE tenant_dfe_documentos SET manifesto_status = ${r.ok ? 'ciencia' : 'ciencia_erro'}, updated_at = NOW() WHERE tenant_id = ${tenantId} AND chave = ${chave};`;
    return r;
  } catch (err) {
    console.warn('[DF-e] Falha ao enviar ciência:', err.message);
    return { ok: false };
  }
}

/** Marca (ou desmarca) uma NF-e capturada como já lançada no financeiro. */
export async function marcarDFeLancada(sql, tenantId, { chave, lancada = true, manual = false, userId = null }) {
  const ch = String(chave || '').replace(/\D/g, '');
  if (ch.length !== 44) return { success: false, error: 'Chave de acesso inválida.' };
  const rows = await sql`
    UPDATE tenant_dfe_documentos
       SET lancada_em = CASE WHEN ${lancada === true} THEN COALESCE(lancada_em, NOW()) ELSE NULL END,
           lancada_por = CASE WHEN ${lancada === true} THEN ${userId} ELSE NULL END,
           lancada_manual = ${lancada === true && manual === true},
           updated_at = NOW()
     WHERE tenant_id = ${tenantId} AND chave = ${ch}
     RETURNING chave, lancada_em, lancada_manual;
  `;
  return rows.length ? { success: true, documento: rows[0] } : { success: true, documento: null };
}

/**
 * Consulta o status atual do Monitor DF-e para o tenant
 */
export async function getDFeStatus(sql, tenantId) {
  const syncRows = await sql`
    SELECT tenant_id, ultimo_nsu, max_nsu, ultima_sincronizacao,
           proxima_consulta_permitida, status_sefaz, mensagem_sefaz, total_documentos,
           updated_at
    FROM tenant_dfe_sync
    WHERE tenant_id = ${tenantId}
    LIMIT 1;
  `;

  const certRows = await sql`
    SELECT cnpj, razao_social, valido_ate, status
    FROM tenant_certificates
    WHERE tenant_id = ${tenantId}
    LIMIT 1;
  `;

  const countRows = await sql`
    SELECT tipo_documento, COUNT(*) as qtd
    FROM tenant_dfe_documentos
    WHERE tenant_id = ${tenantId}
    GROUP BY tipo_documento;
  `;

  const contagemPorTipo = {};
  for (const r of countRows) {
    contagemPorTipo[r.tipo_documento] = parseInt(r.qtd, 10);
  }

  return {
    success: true,
    sync: syncRows[0] || null,
    certificado: certRows[0] || null,
    totais: contagemPorTipo,
    totalGeral: Object.values(contagemPorTipo).reduce((a, b) => a + b, 0)
  };
}

/**
 * Lista os documentos fiscais capturados da SEFAZ
 */
export async function listarDFeDocumentos(sql, tenantId, filters = {}) {
  const tipo = (filters.tipo || '').toUpperCase().trim();
  const busca = (filters.busca || '').trim();
  const limit = Math.min(Math.max(parseInt(filters.limit || '50', 10), 1), 200);
  const offset = Math.max(parseInt(filters.offset || '0', 10), 0);

  let rows;
  if (tipo && busca) {
    const termo = `%${busca}%`;
    rows = await sql`
      SELECT id, tipo_documento, nsu, chave, cnpj_emitente, nome_emitente,
             valor_total, data_emissao, situacao, schema_tipo, manifesto_status,
             lancada_em, lancada_manual,
             (xml_completo IS NOT NULL) AS tem_xml, created_at
      FROM tenant_dfe_documentos
      WHERE tenant_id = ${tenantId}
        AND tipo_documento = ${tipo}
        AND (chave ILIKE ${termo} OR nome_emitente ILIKE ${termo} OR cnpj_emitente ILIKE ${termo})
      ORDER BY data_emissao DESC NULLS LAST, created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `;
  } else if (tipo) {
    rows = await sql`
      SELECT id, tipo_documento, nsu, chave, cnpj_emitente, nome_emitente,
             valor_total, data_emissao, situacao, schema_tipo, manifesto_status,
             lancada_em, lancada_manual,
             (xml_completo IS NOT NULL) AS tem_xml, created_at
      FROM tenant_dfe_documentos
      WHERE tenant_id = ${tenantId}
        AND tipo_documento = ${tipo}
      ORDER BY data_emissao DESC NULLS LAST, created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `;
  } else if (busca) {
    const termo = `%${busca}%`;
    rows = await sql`
      SELECT id, tipo_documento, nsu, chave, cnpj_emitente, nome_emitente,
             valor_total, data_emissao, situacao, schema_tipo, manifesto_status,
             lancada_em, lancada_manual,
             (xml_completo IS NOT NULL) AS tem_xml, created_at
      FROM tenant_dfe_documentos
      WHERE tenant_id = ${tenantId}
        AND (chave ILIKE ${termo} OR nome_emitente ILIKE ${termo} OR cnpj_emitente ILIKE ${termo})
      ORDER BY data_emissao DESC NULLS LAST, created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `;
  } else {
    rows = await sql`
      SELECT id, tipo_documento, nsu, chave, cnpj_emitente, nome_emitente,
             valor_total, data_emissao, situacao, schema_tipo, manifesto_status,
             lancada_em, lancada_manual,
             (xml_completo IS NOT NULL) AS tem_xml, created_at
      FROM tenant_dfe_documentos
      WHERE tenant_id = ${tenantId}
      ORDER BY data_emissao DESC NULLS LAST, created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `;
  }

  return {
    success: true,
    documentos: rows,
    limit,
    offset
  };
}

/**
 * Obtém o XML completo de um documento fiscal capturado
 */
export async function getDFeDocumentoXml(sql, tenantId, docIdOrChave) {
  const cleanId = String(docIdOrChave || '').trim();
  const rows = await sql`
    SELECT id, tipo_documento, chave, xml_completo, nome_emitente, cnpj_emitente, valor_total
    FROM tenant_dfe_documentos
    WHERE tenant_id = ${tenantId}
      AND (id = ${cleanId} OR chave = ${cleanId})
    LIMIT 1;
  `;

  if (!rows.length || !rows[0].xml_completo) {
    return { success: false, error: 'XML do documento não encontrado.' };
  }

  return {
    success: true,
    documento: {
      id: rows[0].id,
      chave: rows[0].chave,
      tipoDocumento: rows[0].tipo_documento,
      nomeEmitente: rows[0].nome_emitente,
      cnpjEmitente: rows[0].cnpj_emitente,
      valorTotal: rows[0].valor_total,
      xml: rows[0].xml_completo
    }
  };
}
