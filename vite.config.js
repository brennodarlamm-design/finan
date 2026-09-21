import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "marketing-routes",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const [pathname, query] = (req.url || "/").split("?");
          const routes = {
            "/": "/landing.html",
            "/planos": "/planos.html",
            "/sobre-nos": "/sobre-nos.html",
            "/login": "/index.html",
            "/cadastro": "/index.html",
            "/app": "/app.html",
            "/master": "/master.html",
            "/privacidade": "/privacidade.html",
            "/termos": "/termos.html",
            "/validar": "/validar.html",
          };
          if (routes[pathname])
            req.url = routes[pathname] + (query ? "?" + query : "");
          next();
        });
      },
    },
  ],
  publicDir: false,
  build: {
    outDir: ".marketing-dist",
    rollupOptions: { input: ["landing.html", "planos.html", "sobre-nos.html"] },
  },
});
