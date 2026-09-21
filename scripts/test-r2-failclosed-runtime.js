import assert from 'node:assert/strict';
import { deleteR2Object, getR2Object, listR2Objects, putR2Object } from '../api/_edge-r2.js';

const key = 'tenants/tenant-ci/docs/runtime-regression.txt';

await assert.rejects(
  () => putR2Object({}, key, Buffer.from('x')),
  /Binding ATTACHMENTS_R2 indisponível/,
  'Upload deve falhar fechado sem binding R2 fora de testes.'
);

await assert.rejects(
  () => deleteR2Object({}, key),
  /Binding ATTACHMENTS_R2 indisponível/,
  'Exclusão deve falhar fechado sem binding R2 fora de testes.'
);

await assert.rejects(
  () => listR2Objects({}, 'tenants/tenant-ci/'),
  /Binding ATTACHMENTS_R2 indisponível/,
  'Listagem deve falhar fechado sem binding R2 fora de testes.'
);

assert.equal(
  await getR2Object({}, key),
  null,
  'Leitura sem binding não pode inventar persistência volátil.'
);

const remoteFailure = {
  ATTACHMENTS_R2: {
    async delete() { throw new Error('simulated-r2-delete-failure'); }
  }
};
await assert.rejects(
  () => deleteR2Object(remoteFailure, key),
  /Falha ao excluir o arquivo no armazenamento Cloudflare R2/,
  'Falha remota de delete deve ser propagada e nunca reportada como sucesso.'
);

const testEnv = { FINOBRA_ALLOW_MEMORY_STORAGE: 'true' };
const stored = await putR2Object(testEnv, key, Buffer.from('ok'), { contentType: 'text/plain' });
assert.equal(stored.storage, 'memory_test_fallback');
assert.equal((await getR2Object(testEnv, key))?.storage, 'memory_fallback');
assert.equal(await deleteR2Object(testEnv, key), true);
assert.equal(await getR2Object(testEnv, key), null);

console.log('✅ R2 fail-closed validado em runtime.');
