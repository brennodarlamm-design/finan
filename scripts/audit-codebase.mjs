import fs from 'fs';
import path from 'path';

const root = process.cwd();
const ignoredDirs = new Set(['.git', 'node_modules', 'dist', '.vercel', 'coverage']);
const sourceExts = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.json', '.yml', '.yaml', '.sql', '.md']);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue;
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (sourceExts.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

function rel(file) { return path.relative(root, file).replaceAll('\\', '/'); }
function countMatches(text, regex) { return [...text.matchAll(regex)].length; }

const files = walk(root);
const records = files.map(file => {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/).length;
  return { file: rel(file), bytes: Buffer.byteLength(text), lines, text };
});

const patterns = {
  todo_fixme_hack: /\b(?:TODO|FIXME|HACK|XXX)\b/gi,
  inner_html: /\binnerHTML\b/g,
  adjacent_html: /\binsertAdjacentHTML\b/g,
  outer_html: /\bouterHTML\b/g,
  eval_like: /\beval\s*\(|\bnew\s+Function\s*\(/g,
  document_write: /\bdocument\.write\s*\(/g,
  local_storage: /\blocalStorage\b/g,
  session_storage: /\bsessionStorage\b/g,
  fetch_calls: /\bfetch\s*\(/g,
  silent_catch: /catch\s*\([^)]*\)\s*\{\s*\}|catch\s*\{\s*\}|\.catch\s*\(\s*\(?.*?\)?\s*=>\s*\{?\s*\}?\s*\)/gs,
  console_log: /\bconsole\.log\s*\(/g,
  console_warn: /\bconsole\.warn\s*\(/g,
  console_error: /\bconsole\.error\s*\(/g,
  wildcard_cors: /Access-Control-Allow-Origin["'`\s,:=]+\*/gi,
  sql_unsafe: /\bunsafe\b|\braw\s*query\b|\bqueryRawUnsafe\b|\bexecuteRawUnsafe\b/gi,
  child_process: /child_process|execFile\s*\(|execSync\s*\(|spawn\s*\(/g,
  hardcoded_secret_marker: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bsk-[A-Za-z0-9_-]{20,}|\bAIza[0-9A-Za-z_-]{20,}|DATABASE_URL\s*=|(?:API_KEY|SECRET|TOKEN|PASSWORD)\s*=\s*["'][^"']{8,}/g,
  set_interval: /\bsetInterval\s*\(/g,
  set_timeout: /\bsetTimeout\s*\(/g,
  window_location: /\bwindow\.location\b/g,
};

const totals = {};
const flagged = [];
for (const rec of records) {
  const hits = {};
  for (const [name, regex] of Object.entries(patterns)) {
    regex.lastIndex = 0;
    const count = countMatches(rec.text, regex);
    if (count) {
      hits[name] = count;
      totals[name] = (totals[name] || 0) + count;
    }
  }
  if (Object.keys(hits).length) flagged.push({ file: rec.file, lines: rec.lines, hits });
}

const largest = [...records]
  .sort((a, b) => b.lines - a.lines)
  .slice(0, 25)
  .map(({ file, lines, bytes }) => ({ file, lines, bytes }));

const jsRecords = records.filter(r => /\.(?:js|mjs|cjs)$/.test(r.file));
const apiRecords = records.filter(r => r.file.startsWith('api/'));
const frontendRecords = records.filter(r => r.file.startsWith('js/') || /\.html$/.test(r.file));
const migrationRecords = records.filter(r => r.file.startsWith('migrations/') || /\.sql$/.test(r.file));

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
let backendPackage = null;
try { backendPackage = JSON.parse(fs.readFileSync(path.join(root, 'backend/package.json'), 'utf8')); } catch {}

const report = {
  generated_at: new Date().toISOString(),
  inventory: {
    files_scanned: records.length,
    source_lines: records.reduce((n, r) => n + r.lines, 0),
    javascript_files: jsRecords.length,
    javascript_lines: jsRecords.reduce((n, r) => n + r.lines, 0),
    frontend_files: frontendRecords.length,
    frontend_lines: frontendRecords.reduce((n, r) => n + r.lines, 0),
    api_files: apiRecords.length,
    api_lines: apiRecords.reduce((n, r) => n + r.lines, 0),
    migration_files: migrationRecords.length,
    migration_lines: migrationRecords.reduce((n, r) => n + r.lines, 0),
  },
  dependencies: {
    root: packageJson.dependencies || {},
    backend: backendPackage?.dependencies || {},
  },
  pattern_totals: totals,
  largest_files: largest,
  flagged_files: flagged
    .sort((a, b) => Object.values(b.hits).reduce((x, y) => x + y, 0) - Object.values(a.hits).reduce((x, y) => x + y, 0))
    .slice(0, 100),
};

fs.mkdirSync(path.join(root, 'audit'), { recursive: true });
fs.writeFileSync(path.join(root, 'audit/patch35-codebase.json'), JSON.stringify(report, null, 2));

console.log('=== FINOBRA CODEBASE AUDIT ===');
console.log(JSON.stringify(report.inventory, null, 2));
console.log('\n=== PATTERN TOTALS ===');
console.log(JSON.stringify(report.pattern_totals, null, 2));
console.log('\n=== 25 LARGEST FILES ===');
for (const item of report.largest_files) console.log(`${String(item.lines).padStart(6)} lines  ${item.file}`);
console.log('\n=== TOP FLAGGED FILES ===');
for (const item of report.flagged_files.slice(0, 40)) console.log(`${item.file}: ${JSON.stringify(item.hits)}`);
console.log('\nReport: audit/patch35-codebase.json');
