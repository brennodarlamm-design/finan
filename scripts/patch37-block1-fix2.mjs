import fs from 'fs';

// Remove a função física criada no primeiro rascunho. /api/health será rewrite do dispatcher auth.
if (fs.existsSync('api/health.js')) fs.rmSync('api/health.js');

let auth = fs.readFileSync('api/auth.js','utf8');
if (!auth.includes("action === 'health'")) {
  const marker = "  if (req.method === 'OPTIONS') {\n    return res.status(200).end();\n  }\n\n";
  if (!auth.includes(marker)) throw new Error('Patch37: ponto público do dispatcher auth não encontrado.');
  const health = `  const action = req.query.action || (req.body && req.body.action);\n\n  // Patch 37: health público de release, sem DB/sessão e sem nova Serverless Function.\n  if ((req.method === 'GET' || req.method === 'HEAD') && action === 'health') {\n    const commit = String(\n      process.env.FINOBRA_RELEASE_SHA ||\n      process.env.VERCEL_GIT_COMMIT_SHA ||\n      process.env.GITHUB_SHA ||\n      'unknown'\n    ).trim();\n    const deploymentId = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_URL || null;\n    const releaseReady = !!commit && commit !== 'unknown';\n    res.setHeader('X-Content-Type-Options', 'nosniff');\n    if (req.method === 'HEAD') return res.status(200).end();\n    return res.status(200).json({\n      ok:true,\n      service:'finobra-api',\n      releaseReady,\n      release:{\n        commit,\n        deploymentId,\n        source: process.env.VERCEL === '1' ? 'vercel' : 'serverless',\n        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'\n      }\n    });\n  }\n\n`;
  auth = auth.replace(marker, marker + health);
  const duplicate = "    const sql = getSql();\n    const action = req.query.action || (req.body && req.body.action);\n";
  if (!auth.includes(duplicate)) throw new Error('Patch37: declaração original de action não encontrada.');
  auth = auth.replace(duplicate, "    const sql = getSql();\n");
}
fs.writeFileSync('api/auth.js', auth, 'utf8');

let vercel = fs.readFileSync('vercel.json','utf8');
if (!vercel.includes('"source": "/api/health"')) {
  const anchor = '  "rewrites": [\n';
  if (!vercel.includes(anchor)) throw new Error('Patch37: rewrites Vercel não encontrados.');
  vercel = vercel.replace(anchor, `${anchor}    {\n      "source": "/api/health",\n      "destination": "/api/auth?action=health"\n    },\n`);
}
fs.writeFileSync('vercel.json', vercel, 'utf8');

let test37 = fs.readFileSync('scripts/test-patch37-static.js','utf8');
test37 = test37.replace("const health=fs.readFileSync('api/health.js','utf8');", "const apiAuth=fs.readFileSync('api/auth.js','utf8');");
test37 = test37.replace(
  "assert(health.includes(\"service:'finobra-api'\") && health.includes('FINOBRA_RELEASE_SHA') && health.includes('VERCEL_GIT_COMMIT_SHA'),'API possui health público com commit de release.');",
  "assert(apiAuth.includes(\"action === 'health'\") && apiAuth.includes(\"service:'finobra-api'\") && apiAuth.includes('FINOBRA_RELEASE_SHA') && apiAuth.includes('VERCEL_GIT_COMMIT_SHA') && vercel.includes('/api/auth?action=health'),'API possui health público de release sem criar nova Serverless Function.');"
);
if (test37.includes("fs.readFileSync('api/health.js'")) throw new Error('Patch37: teste ainda depende de função health física.');
fs.writeFileSync('scripts/test-patch37-static.js', test37, 'utf8');

console.log('✅ Patch 37 health consolidado em /api/auth?action=health sem aumentar funções Vercel.');
