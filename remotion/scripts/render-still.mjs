import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('[1/4] Starting bundle of src/index.ts...');
  const entryPoint = path.resolve(__dirname, '../src/index.ts');
  const bundleLocation = await bundle({
    entryPoint,
    onProgress: (p) => {
      if (p % 25 === 0) console.log(`Bundling: ${p}%`);
    },
  });
  console.log('[2/4] Bundle ready at:', bundleLocation);

  console.log('[3/4] Selecting composition LogoReveal...');
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'LogoReveal',
  });
  console.log(`[3/4] Selected: ${composition.id} (${composition.width}x${composition.height}, ${composition.durationInFrames} frames)`);

  const output = path.resolve(__dirname, '../dist/logo-reveal-frame60.png');
  console.log('[4/4] Rendering frame 60 to:', output);
  await renderStill({
    composition,
    serveUrl: bundleLocation,
    output,
    frame: 60,
  });
  console.log('[SUCCESS] Still rendered successfully at:', output);
}

main().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});
