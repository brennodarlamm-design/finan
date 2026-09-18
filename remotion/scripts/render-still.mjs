import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
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

  console.log('[3/4] Selecting composition HeroVideo...');
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'HeroVideo',
  });
  console.log(`[3/4] Selected: ${composition.id} (${composition.width}x${composition.height}, ${composition.durationInFrames} frames)`);

  const stillOutput = path.resolve(__dirname, '../dist/hero-video-preview.png');
  console.log('[4/4] Rendering frame 140 still to:', stillOutput);
  await renderStill({
    composition,
    serveUrl: bundleLocation,
    output: stillOutput,
    frame: 140,
  });
  console.log('[SUCCESS] Still rendered successfully at:', stillOutput);

  const videoOutput = path.resolve(__dirname, '../dist/hero-video.mp4');
  console.log('[5/5] Rendering HeroVideo MP4 (300 frames, 60fps equivalent) to:', videoOutput);
  let lastP = -1;
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: videoOutput,
    onProgress: ({ renderedFrames, totalFrames }) => {
      const p = Math.floor((renderedFrames / totalFrames) * 100);
      if (p % 20 === 0 && p !== lastP) {
        console.log(`   Progress: ${p}% (${renderedFrames}/${totalFrames} frames)`);
        lastP = p;
      }
    },
  });
  console.log('[SUCCESS] Video rendered successfully at:', videoOutput);
}

main().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});
