// Patch 26 final normalizer — handles the last mixed-template DOM id safely.
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
  fs.writeFileSync(actionsFile, actions);
}

console.log('[Patch26 final] handler dinâmico de upload documental normalizado.');
