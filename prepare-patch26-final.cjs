// Patch 26 final normalizer — handles the last mixed-template DOM id and
// removes javascript: navigation before strict CSP enforcement.
const fs = require('fs');
const path = require('path');
const root = __dirname;

const fasesFile = path.join(root, 'js', 'fases_doc.js');
let fases = fs.readFileSync(fasesFile, 'utf8');
fases = fases
  .split("onclick=\"document.getElementById('fd-file-in-${docId}').click()\"")
  .join("onclick=\"Patch26Actions.fasesClickFile('${docId}')\"")
  .split("onclick=\"Patch26Actions.clickById('fd-file-in-${docId}')\"")
  .join("onclick=\"Patch26Actions.fasesClickFile('${docId}')\"");
fs.writeFileSync(fasesFile, fases);

const actionsFile = path.join(root, 'js', 'patch26-actions.js');
let actions = fs.readFileSync(actionsFile, 'utf8');
if (!actions.includes('fasesClickFile(docId) {')) {
  actions = actions.replace(
    '  fasesBackdropClose(ev, el) {',
    "  fasesClickFile(docId) { this.clickById(`fd-file-in-${String(docId || '')}`); },\n  fasesBackdropClose(ev, el) {"
  );
}
if (!actions.includes('FINOBRA_PATCH26_HASH_LINK_GUARD')) {
  actions += `\n/* FINOBRA_PATCH26_HASH_LINK_GUARD — javascript: URLs were replaced with #. */\ndocument.addEventListener('click', ev => {\n  const link = ev.target?.closest?.('a[href="#"][data-fb-click]');\n  if (link) ev.preventDefault();\n}, true);\n`;
}
fs.writeFileSync(actionsFile, actions);

// javascript: links are script execution surfaces too. Replace only the legacy
// no-op href forms; the real behavior remains in the migrated click action.
const scanFiles = ['index.html', 'app.html', 'master.html', 'landing.html', 'validar.html'];
const jsDir = path.join(root, 'js');
for (const name of fs.readdirSync(jsDir)) {
  if (name.endsWith('.js')) scanFiles.push(`js/${name}`);
}
let replacedUrls = 0;
for (const rel of scanFiles) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  src = src.replace(/href=(['"])javascript:void\(0\)\1/gi, 'href="#"');
  src = src.replace(/href=(['"])javascript:;?\1/gi, 'href="#"');
  if (src !== before) {
    replacedUrls += (before.match(/href=(['"])javascript:/gi) || []).length;
    fs.writeFileSync(file, src);
  }
}

console.log(`[Patch26 final] handler documental normalizado; ${replacedUrls} javascript: URL(s) removidas.`);
