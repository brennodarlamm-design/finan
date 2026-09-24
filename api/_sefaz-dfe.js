// api/_sefaz-dfe.js — Motor de Distribuição DF-e da SEFAZ (NFe e CTe) Multi-Tenant
// Conexão mTLS direta com SEFAZ Nacional via certificado A1 RFC 7292

import https from 'node:https';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { decryptCertData } from './_certificado.js';

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
function callSefazHttps({ pfxBuffer, passphrase, hostname, path, actionHeader, soapBody, timeout = 30000 }) {
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

    return {
      sucesso: true,
      nsu: String(nsu || '').padStart(15, '0'),
      chave: chave || null,
      tipoDocumento: tipo,
      cnpjEmitente: cnpjEmitente ? cnpjEmitente.replace(/\D/g, '') : null,
      nomeEmitente: nomeEmitente || null,
      valorTotal: valorTotal || 0,
      dataEmissao: dataEmissao ? new Date(dataEmissao).toISOString() : null,
      situacao: situacao,
      schemaTipo: schemaTipo,
      xml: xml
    };
  } catch (err) {
    console.error(`[DF-e] Erro ao descompactar docZip (NSU ${nsu}):`, err.message);
    return { sucesso: false, erro: err.message, nsu };
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
        success: false,
        rateLimited: true,
        proximaConsulta: proximaData.toISOString(),
        minutosRestantes,
        message: `Aguarde ${minutosRestantes} minuto(s) para nova consulta na SEFAZ (regra de consumo indevido / cStat 656/137).`
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
  const codUf = options.codUf || '14'; // Padrão: 14 (RR) ou conforme UF informada
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
            mensagem_sefaz = ${'Falha de comunicação com a SEFAZ: ' + errNet.message},
            updated_at = NOW()
        WHERE tenant_id = ${tenantId};
      `;
      return {
        success: false,
        error: `Falha ao comunicar com os servidores da SEFAZ: ${errNet.message}`
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

        const docId = `dfe_${tenantId}_${parsed.chave}`;
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
            situacao = COALESCE(EXCLUDED.situacao, tenant_dfe_documentos.situacao),
            schema_tipo = EXCLUDED.schema_tipo,
            xml_completo = COALESCE(EXCLUDED.xml_completo, tenant_dfe_documentos.xml_completo),
            updated_at = NOW();
        `;
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

      // Se já alcançamos o maxNSU, não há mais lotes
      if (ultNsu >= maxNsu) {
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
            updated_at = NOW()
        WHERE tenant_id = ${tenantId};
      `;
      break;
    }
  }

  // 5. Retorna o resumo consolidado
  const contagem = await sql`
    SELECT COUNT(*) as count FROM tenant_dfe_documentos WHERE tenant_id = ${tenantId};
  `;

  return {
    success: true,
    cStat: lastCStat,
    mensagem: lastMotivo,
    novosDocumentos: totalProcessados,
    ultimoNsu: ultNsu,
    totalDocumentos: parseInt(contagem[0]?.count || '0', 10)
  };
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
