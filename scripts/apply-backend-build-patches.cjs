// Reproduz no npm test o mesmo resultado de hardening executado pelo Dockerfile do Render.
// Patch 22 usa o diff original, direcionado explicitamente para backend/ no worktree.
// Patch 23 é espelhado por substituições exatas/fail-closed porque o diff legado foi
// gerado sobre um offset intermediário e não é portátil fora do Docker build.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const backendDir = path.join(root, 'backend');
const serverFile = path.join(backendDir, 'server.js');
const patch22File = path.join(backendDir, 'patch22-server.diff');

function gitApply(args) {
  return spawnSync('git', ['apply', ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

// 1) Patch 22 exatamente sobre backend/server.js no worktree.
const patch22Args = ['--directory=backend', '-p2', patch22File];
const check22 = gitApply(['--check', ...patch22Args]);
if (check22.status === 0) {
  const apply22 = gitApply(patch22Args);
  if (apply22.status !== 0) {
    console.error(apply22.stderr || apply22.stdout || '[Backend build] falha ao aplicar Patch 22');
    process.exit(apply22.status || 1);
  }
  console.log('[Backend build] aplicado: patch22-server.diff -> backend/server.js');
} else {
  const reverse22 = gitApply(['--reverse', '--check', ...patch22Args]);
  if (reverse22.status !== 0) {
    console.error('[Backend build] patch22-server.diff é incompatível com backend/server.js atual.');
    console.error(check22.stderr || check22.stdout || 'git apply --check falhou');
    process.exit(1);
  }
  console.log('[Backend build] Patch 22 já aplicado em backend/server.js');
}

let src = fs.readFileSync(serverFile, 'utf8');
for (const marker of ['function signQrAccess(', "app.get('/status', requireAuth", 'crypto.timingSafeEqual']) {
  if (!src.includes(marker)) {
    console.error(`[Backend build] Patch 22 não materializou marcador obrigatório em backend/server.js: ${marker}`);
    process.exit(1);
  }
}

// 2) Espelha semanticamente o Patch 23 com âncoras exatas.
function replaceExact(label, before, after) {
  if (src.includes(after)) {
    console.log(`[Backend build] Patch 23 já contém: ${label}`);
    return;
  }
  if (!src.includes(before)) {
    console.error(`[Backend build] âncora ausente para Patch 23: ${label}`);
    process.exit(1);
  }
  src = src.replace(before, after);
  console.log(`[Backend build] Patch 23 aplicado: ${label}`);
}

replaceExact(
  'limite HTTP 12 MB',
  "app.use(express.json({ limit: '25mb' }));\napp.use(express.urlencoded({ extended: true, limit: '25mb' }));",
  "app.use(express.json({ limit: '12mb' }));\napp.use(express.urlencoded({ extended: true, limit: '12mb' }));"
);

replaceExact(
  'restart em erro fatal',
  "  } else {\n    console.error('Stack:', err?.stack);\n  }\n});",
  "  } else {\n    console.error('Stack:', err?.stack);\n    setTimeout(() => process.exit(1), 100).unref?.();\n  }\n});"
);

replaceExact(
  'telefone explícito obrigatório',
  "    const { phone, message, text, base64, mimeType, fileName, caption } = req.body;\n    const destPhone = phone || TARGET_PHONE;\n    const msgText = message || text || caption || '';\n\n    if (!msgText && !base64) {",
  "    const { phone, message, text, base64, mimeType, fileName, caption } = req.body;\n    const destPhone = String(phone || '').replace(/\\D/g, '');\n    const msgText = message || text || caption || '';\n\n    if (!destPhone || destPhone.length < 10 || destPhone.length > 15) {\n      return res.status(400).json({ error: 'Campo \\\"phone\\\" é obrigatório e deve conter um número válido.' });\n    }\n\n    if (!msgText && !base64) {"
);

replaceExact(
  'validação de mídia 8 MB e MIME seguro',
  "      const cleanB64 = base64.replace(/^data:[^;]+;base64,/, '');\n      const buf = Buffer.from(cleanB64, 'base64');\n      const mime = mimeType || 'application/pdf';\n\n      if (mime.startsWith('image/')) {",
  "      const cleanB64 = String(base64).replace(/^data:[^;]+;base64,/, '');\n      const buf = Buffer.from(cleanB64, 'base64');\n      const MAX_MEDIA_BYTES = 8 * 1024 * 1024;\n      if (buf.length === 0 || buf.length > MAX_MEDIA_BYTES) {\n        return res.status(413).json({ error: 'Arquivo inválido ou acima do limite de 8 MB.' });\n      }\n      const mime = String(mimeType || 'application/pdf').split(';')[0].trim().toLowerCase();\n      const forbiddenMime = /^(?:text\\/html|image\\/svg\\+xml|application\\/xhtml\\+xml|text\\/javascript|application\\/javascript)$/i;\n      if (forbiddenMime.test(mime)) {\n        return res.status(400).json({ error: 'Tipo de mídia não permitido.' });\n      }\n\n      if (/^image\\/(?:jpeg|png|webp)$/i.test(mime)) {"
);

fs.writeFileSync(serverFile, src);

// Garante que o simulador continua equivalente às regras materializadas no diff de produção.
const patch23Text = fs.readFileSync(path.join(backendDir, 'patch23-server.diff'), 'utf8');
for (const marker of ["limit: '12mb'", 'MAX_MEDIA_BYTES = 8 * 1024 * 1024', 'Campo \"phone\" é obrigatório', 'process.exit(1)']) {
  if (!patch23Text.includes(marker)) {
    console.error(`[Backend build] diff de produção Patch 23 perdeu marcador esperado: ${marker}`);
    process.exit(1);
  }
}

const syntax = spawnSync(process.execPath, ['--check', serverFile], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
});
if (syntax.status !== 0) {
  console.error('[Backend build] server.js inválido após hardening.');
  console.error(syntax.stderr || syntax.stdout || 'node --check falhou');
  process.exit(syntax.status || 1);
}
console.log('[Backend build] resultado dos Patches 22/23 reproduzido e sintaxe validada.');
