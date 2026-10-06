// api/_file-validation.js — Validação de arquivos que chegam em base64 fora do /api/upload.
//
// AUDITORIA 2026-10-04 #31: o /api/upload valida extensão, MIME, tamanho e magic bytes, mas o
// `save` e o `sync_all` de documentos aceitavam `base64_data` direto e gravavam no banco sem
// nenhuma dessas checagens (HTML/SVG/executável, arquivos de 100 MB, extensão falsa).
// Este módulo aplica a mesma política do /api/upload a esse caminho. Roda no Worker e no
// Render, por isso não depende de Buffer: decodifica só o começo do arquivo com atob.

export const MAX_ARQUIVO_BYTES = 15 * 1024 * 1024; // 15 MB, igual ao /api/upload

const EXTENSOES_SUSPEITAS = ['exe', 'bat', 'cmd', 'sh', 'js', 'vbs', 'scr', 'php', 'py', 'html', 'htm', 'jar'];
const EXTENSOES_BLOQUEADAS = ['html', 'htm', 'svg', 'xhtml', 'exe', 'bat', 'cmd', 'sh', 'js', 'vbs', 'scr', 'php', 'py'];
const MIMES_BLOQUEADOS = ['text/html', 'image/svg+xml', 'application/xhtml+xml', 'application/x-msdownload', 'text/javascript', 'application/javascript'];

// Mesma tabela do /api/upload: extensão → MIMEs aceitos → assinatura binária.
const TABELA = [
  { exts: ['pdf'], mime: ['application/pdf'], magic: ['25504446'] },
  { exts: ['png'], mime: ['image/png'], magic: ['89504E47'] },
  { exts: ['jpg', 'jpeg'], mime: ['image/jpeg'], magic: ['FFD8FF'] },
  { exts: ['webp'], mime: ['image/webp'], magicValidator: (hex) => hex.startsWith('52494646') && hex.slice(16, 24) === '57454250' },
  { exts: ['zip'], mime: ['application/zip', 'application/x-zip-compressed'], magic: ['504B0304', '504B0506', '504B0708'] },
  { exts: ['xlsx'], mime: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], magic: ['504B0304'] },
  { exts: ['docx'], mime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], magic: ['504B0304'] },
  { exts: ['xls'], mime: ['application/vnd.ms-excel'], magic: ['D0CF11E0'] },
  { exts: ['doc'], mime: ['application/msword'], magic: ['D0CF11E0'] },
  { exts: ['dwg'], mime: ['application/acad', 'application/x-acad', 'image/vnd.dwg'], magic: ['41433130', '41433131', '41433132', '41433133', '41433134', '41433135'] },
  { exts: ['glb'], mime: ['model/gltf-binary'], magic: ['676C5446'] },
  { exts: ['rar'], mime: ['application/x-rar-compressed'], magic: ['526172211A07'] },
  { exts: ['7z'], mime: ['application/x-7z-compressed'], magic: ['377ABCAF271C'] },
  { exts: ['txt', 'csv', 'xml', 'ofx', 'qfx', 'dxf'], textOnly: true, mime: ['text/plain', 'text/csv', 'application/xml', 'text/xml', 'application/x-ofx', 'application/ofx', 'image/vnd.dxf'] },
  { exts: ['ifc'], textOnly: true, mime: ['text/plain', 'application/x-step', 'model/ifc'] },
  { exts: ['obj'], textOnly: true, mime: ['text/plain', 'model/obj'] },
  { exts: ['gltf'], textOnly: true, mime: ['application/json', 'text/plain', 'model/gltf+json'] },
];

function limparMime(m) {
  return String(m || '').split(';')[0].trim().toLowerCase();
}

function extensaoPorMime(mime) {
  const entrada = TABELA.find((e) => e.mime.includes(mime));
  return entrada ? entrada.exts[0] : '';
}

function decodificarInicio(b64, bytes) {
  const limpo = String(b64).replace(/\s+/g, '');
  const pedaco = limpo.slice(0, Math.ceil(bytes / 3) * 4);
  const bin = atob(pedaco.slice(0, pedaco.length - (pedaco.length % 4)));
  let hex = '';
  for (let i = 0; i < Math.min(bin.length, 12); i++) hex += bin.charCodeAt(i).toString(16).padStart(2, '0');
  return { hex: hex.toUpperCase(), texto: bin.slice(0, bytes) };
}

/**
 * Valida um arquivo em base64 (ou data URL) com a política do /api/upload.
 * @returns {{ ok: true } | { ok: false, code: string, error: string }}
 */
export function validarArquivoBase64({ nomeArquivo, mime, base64 } = {}) {
  if (!base64) return { ok: true };
  const recusa = (code, error) => ({ ok: false, code, error });

  let conteudo = String(base64);
  let mimeDeclarado = limparMime(mime);
  if (conteudo.startsWith('data:')) {
    const virgula = conteudo.indexOf(',');
    if (virgula < 0) return recusa('FILE_INVALID', 'Arquivo em formato inválido.');
    const cabecalho = conteudo.slice(5, virgula);
    const mimeDataUrl = limparMime(cabecalho);
    if (MIMES_BLOQUEADOS.includes(mimeDataUrl)) return recusa('FILE_TYPE_BLOCKED', 'Tipo de arquivo não permitido por políticas de segurança do FinGo.');
    if (!/;base64$/i.test(cabecalho)) return recusa('FILE_INVALID', 'Arquivo em formato inválido.');
    if (mimeDataUrl && (!mimeDeclarado || mimeDeclarado === 'application/octet-stream')) mimeDeclarado = mimeDataUrl;
    conteudo = conteudo.slice(virgula + 1);
  }
  if (!mimeDeclarado) mimeDeclarado = 'application/octet-stream';

  const nome = String(nomeArquivo || '').trim();
  const partes = nome.split('.');
  if (partes.length > 2 && partes.some((p, i) => i < partes.length - 1 && EXTENSOES_SUSPEITAS.includes(p.toLowerCase()))) {
    return recusa('FILE_TYPE_BLOCKED', 'Nome de arquivo suspeito contendo extensão executável oculta.');
  }
  const ext = (partes.length > 1 ? partes.pop() : extensaoPorMime(mimeDeclarado)).toLowerCase();
  if (EXTENSOES_BLOQUEADAS.includes(ext) || MIMES_BLOQUEADOS.includes(mimeDeclarado)) {
    return recusa('FILE_TYPE_BLOCKED', 'Tipo de arquivo não permitido por políticas de segurança do FinGo.');
  }
  const entrada = TABELA.find((e) => e.exts.includes(ext));
  if (!entrada) return recusa('FILE_TYPE_BLOCKED', 'Tipo de arquivo não permitido por políticas de segurança do FinGo.');
  if (mimeDeclarado !== 'application/octet-stream' && !entrada.mime.includes(mimeDeclarado)) {
    return recusa('FILE_TYPE_MISMATCH', `MIME "${mimeDeclarado}" não é compatível com a extensão ".${ext}".`);
  }

  const tamanho = Math.ceil(conteudo.replace(/\s+/g, '').length * 0.75);
  if (tamanho > MAX_ARQUIVO_BYTES) return recusa('FILE_TOO_LARGE', 'Arquivo excede o limite máximo permitido de 15 MB.');

  let inicio;
  try {
    inicio = decodificarInicio(conteudo, 1024);
  } catch {
    return recusa('FILE_INVALID', 'Arquivo em formato inválido.');
  }
  const textoMinusculo = inicio.texto.toLowerCase();
  if (inicio.hex.startsWith('4D5A') || inicio.hex.startsWith('7F454C46') || inicio.texto.startsWith('#!/')
    || textoMinusculo.includes('<html') || textoMinusculo.includes('<script')) {
    return recusa('FILE_CONTENT_BLOCKED', 'Assinatura binária do arquivo rejeitada (contém conteúdo executável ou script).');
  }
  const assinaturaOk = entrada.magicValidator
    ? entrada.magicValidator(inicio.hex)
    : (!entrada.magic || entrada.magic.some((p) => inicio.hex.startsWith(p)));
  if (!assinaturaOk) {
    return recusa('FILE_CONTENT_MISMATCH', 'Conteúdo binário do arquivo não corresponde à extensão declarada.');
  }
  return { ok: true };
}
