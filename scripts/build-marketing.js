import { build } from "vite";
import fs from "node:fs";
import path from "node:path";
// This distribution command must run only after commit and push (AGENTS.md).
await build();
const destination = process.argv[2] || (process.env.VERCEL ? "." : "dist");
fs.mkdirSync(destination, { recursive: true });
for (const file of [
  "landing.html",
  "planos.html",
  "sobre-nos.html",
  "manuais.html",
  "blog.html",
  "assets",
]) {
  // O Vite preserva o caminho da entrada: marketing/pages/X.html → .marketing-dist/marketing/pages/X.html.
  const built = file === "assets" ? path.join(".marketing-dist", file) : path.join(".marketing-dist", "marketing", "pages", file);
  fs.cpSync(built, path.join(destination, file), {
    recursive: true,
  });
}
if (destination !== ".")
  fs.copyFileSync(
    path.join(destination, "landing.html"),
    path.join(destination, "index.html"),
  );
// SEO/AEO/GEO: HTML com conteúdo no #root e uma página por artigo do blog.
const { prerenderMarketing } = await import("./prerender-marketing.mjs");
const prerendered = await prerenderMarketing(path.resolve(destination));
console.log(`✅ Pré-renderização SEO/GEO: ${prerendered.length} páginas`);
