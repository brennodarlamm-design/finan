import fs from 'fs';

const bridgePath = 'js/patch26-events.js';
const testPath = 'scripts/test-patch26-static.js';

let bridge = fs.readFileSync(bridgePath, 'utf8');
const oldSeq = '"Cobranca.abrirModalPagamentoPix","Cobranca.selecionarPlano","Configuracoes._switch"';
const newSeq = '"Cobranca.abrirModalPagamentoPix","Cobranca.goToPlans","Cobranca.selecionarPlano","Cobranca.switchAccountTab","Configuracoes._switch"';
if (!bridge.includes('"Cobranca.goToPlans"') || !bridge.includes('"Cobranca.switchAccountTab"')) {
  if (!bridge.includes(oldSeq)) throw new Error('Sequência esperada da allowlist Cobranca não encontrada.');
  bridge = bridge.replace(oldSeq, newSeq);
  fs.writeFileSync(bridgePath, bridge, 'utf8');
}

let test = fs.readFileSync(testPath, 'utf8');
if (!test.includes('todas as ações data-fb-* usadas estão na allowlist')) {
  const anchor = "ok('bridge usa allowlist exata de ações', bridge.includes('const ALLOWED = new Set(') && bridge.includes('ALLOWED.has(path)'));";
  if (!test.includes(anchor)) throw new Error('Âncora do teste Patch 26 não encontrada.');
  const addition = `${anchor}\n\nconst allowlistMatch = bridge.match(/const ALLOWED = new Set\\((\\[[\\s\\S]*?\\])\\);/);\nlet declaredAllowed = new Set();\ntry { declaredAllowed = new Set(JSON.parse(allowlistMatch?.[1] || '[]')); } catch {}\nconst referencedActions = new Set();\nfor (const file of files) {\n  const src = fs.readFileSync(file, 'utf8');\n  for (const m of src.matchAll(/data-fb-(?:click|change|input|submit|mouseover|mouseout|mouseenter|mouseleave|keydown|keyup|keypress|focus|blur|dblclick|contextmenu|pointerdown|pointerup|mousedown|mouseup|touchstart|touchend|dragstart|drop)=\"([^\"]+)\"/g)) referencedActions.add(m[1]);\n}\nconst missingAllowed = [...referencedActions].filter(action => !declaredAllowed.has(action));\nok('todas as ações data-fb-* usadas estão na allowlist', missingAllowed.length === 0);\nif (missingAllowed.length) console.error('Ações ausentes da allowlist:', missingAllowed.sort().join(', '));`;
  test = test.replace(anchor, addition);
  fs.writeFileSync(testPath, test, 'utf8');
}

console.log('Hotfix Patch 36 CSP aplicado: Conta & Assinatura liberada e teste de cobertura da allowlist reforçado.');
