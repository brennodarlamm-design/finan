import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const compositions = [
  { id: 'LogoReveal', output: 'dist/logo-reveal.mp4' },
  { id: 'HeroVideo', output: 'dist/hero-video.mp4' },
  { id: 'OGVideo', output: 'dist/og-video.mp4' },
  { id: 'FeatureDemo', output: 'dist/feature-demo.mp4' },
];

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const distDir = path.join(rootDir, 'dist');
  fs.mkdirSync(distDir, { recursive: true });

  console.log('📦 Bundling Remotion project...');
  const bundleLocation = await bundle({
    entryPoint: path.join(rootDir, 'src/index.ts'),
  });
  console.log('✅ Bundle created successfully!');

  for (const item of compositions) {
    console.log(`\n🎬 Starting render: [${item.id}] -> ${item.output}`);
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: item.id,
    });

    const outputPath = path.join(rootDir, item.output);
    let lastReported = -1;

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      onProgress: ({ renderedFrames, totalFrames }) => {
        const percent = Math.floor((renderedFrames / totalFrames) * 100);
        if (percent % 20 === 0 && percent !== lastReported) {
          console.log(`   [${item.id}] Progress: ${percent}% (${renderedFrames}/${totalFrames} frames)`);
          lastReported = percent;
        }
      },
    });

    console.log(`✅ Finished ${item.id}: ${outputPath}`);
  }

  console.log('\n🎉 ALL FINGO VIDEOS RENDERED SUCCESSFULLY!');
}

main().catch((err) => {
  console.error('❌ Render failed:', err);
  process.exit(1);
});

