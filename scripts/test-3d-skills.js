import fs from 'fs';

const files = [
  '.agents/skills/build123d-cad-modeling/SKILL.md',
  '.agents/skills/generate-3d-model/SKILL.md',
  '.agents/skills/fingo-bim-3d-pipeline/SKILL.md'
];

let failed = false;
const assert = (ok, msg) => {
  console.log(`${ok ? '✅' : '❌'} ${msg}`);
  if (!ok) failed = true;
};

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const fm = src.match(/^---\n([\s\S]*?)\n---/);
  assert(Boolean(fm), `${file}: frontmatter YAML presente`);
  assert(/\nname:\s+[a-z0-9-]+\n/.test('\n' + (fm?.[1] || '') + '\n'), `${file}: name em minúsculas e hífens`);
  assert(/\ndescription:\s*>?/.test('\n' + (fm?.[1] || '') + '\n'), `${file}: description presente`);
  assert(/## When to use/i.test(src), `${file}: gatilhos When to use`);
  assert(/## Constraints/i.test(src), `${file}: Constraints presentes`);
  assert(/## Workflow/i.test(src), `${file}: Workflow determinístico presente`);
}

const b = fs.readFileSync(files[0], 'utf8');
assert(b.includes('15 MB') && b.includes('150.000'), 'build123d respeita limites do viewer');
assert(b.includes('uvx --from build123d'), 'build123d possui comando determinístico de execução');

const g = fs.readFileSync(files[1], 'utf8');
assert(g.includes('autorização') && g.includes('serviço externo'), 'geração por imagem exige consentimento para serviço externo');
assert(g.includes('authoritative_bim: false'), 'modelo por IA não pode virar BIM autoritativo');

const o = fs.readFileSync(files[2], 'utf8');
assert(o.includes('Clash detection') && o.includes('geometria real'), 'orquestrador impede clash fictício');

const blender = fs.readFileSync('.agents/skills/generate-3d-model/scripts/optimize_glb_blender.py', 'utf8');
assert(blender.includes('bpy.ops.import_scene.gltf') && blender.includes('bpy.ops.export_scene.gltf'), 'workflow Blender importa e exporta GLB');
assert(blender.includes('DECIMATE') && blender.includes('target_triangles'), 'workflow Blender aplica orçamento determinístico de triângulos');

if (failed) process.exit(1);
console.log('✅ Skills 3D/BIM do FinGo validadas.');
