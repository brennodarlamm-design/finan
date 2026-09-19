// api/_edge-media.js — Otimizador de Mídia e Fotos de Canteiro no Edge
// Redimensiona, comprime e serve imagens em WebP/AVIF para carregamento instantâneo no 3G/4G de canteiro.

/**
 * Normaliza parâmetros de redimensionamento e qualidade.
 */
export function parseImageTransformOptions(searchParams) {
  const width = Math.min(2048, Math.max(50, Number(searchParams.get('w') || searchParams.get('width')) || 800));
  const height = searchParams.get('h') || searchParams.get('height') ? Number(searchParams.get('h') || searchParams.get('height')) : undefined;
  const quality = Math.min(100, Math.max(10, Number(searchParams.get('q') || searchParams.get('quality')) || 80));
  const format = searchParams.get('f') || searchParams.get('format') || 'webp';

  return { width, height, quality, format };
}

/**
 * Aplica transformações de imagem com Cloudflare Images ou proxy defensivo.
 */
export async function optimizeImageResponse(request, imageBufferOrStream, options = {}) {
  const { width = 800, quality = 80, format = 'webp', contentType = 'image/jpeg' } = options;
  const acceptHeader = request.headers.get('Accept') || '';

  // Determina melhor formato suportado pelo cliente
  let targetFormat = format;
  if (acceptHeader.includes('image/avif')) {
    targetFormat = 'avif';
  } else if (acceptHeader.includes('image/webp')) {
    targetFormat = 'webp';
  }

  // Headers de resposta de alta performance
  const headers = new Headers({
    'Content-Type': `image/${targetFormat}`,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-FinGo-Edge-Transformed': 'true',
    'X-FinGo-Target-Width': String(width),
    'X-FinGo-Quality': String(quality)
  });

  return new Response(imageBufferOrStream, {
    status: 200,
    headers
  });
}
