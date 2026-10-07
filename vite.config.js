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
          // Os HTML ficam em marketing/pages/ (públicas) e frontend/ (shells da aplicação).
          const mk = (f) => "/marketing/pages/" + f;
          const fe = (f) => "/frontend/" + f;
          const routes = {
            "/": mk("landing.html"),
            "/landing": mk("landing.html"),
            "/planos": mk("planos.html"),
            "/sobre-nos": mk("sobre-nos.html"),
            "/manuais": mk("manuais.html"),
            "/blog": mk("blog.html"),
            "/calculadora-bdi": mk("calculadora-bdi.html"),
            "/privacidade": mk("privacidade.html"),
            "/termos": mk("termos.html"),
            "/validar": mk("validar.html"),
            "/login": fe("index.html"),
            "/cadastro": fe("index.html"),
            "/app": fe("app.html"),
            "/master": fe("master.html"),
            "/bim": fe("bim.html"),
          };
          // Também atende os nomes antigos (/app.html, /planos.html...) usados nos links internos.
          for (const [rota, arquivo] of Object.entries({ ...routes })) {
            if (rota !== "/" && rota !== "/cadastro") routes[rota + ".html"] = arquivo;
          }
          routes["/index.html"] = fe("index.html");
          routes["/login.html"] = fe("index.html");
          if (routes[pathname])
            req.url = routes[pathname] + (query ? "?" + query : "");
          else if (/^\/blog\/[a-z0-9-]+$/.test(pathname))
            req.url = mk("blog.html") + (query ? "?" + query : "");
          next();
        });
      },
    },
  ],
  publicDir: false,
  build: {
    outDir: ".marketing-dist",
    rollupOptions: {
      input: [
        "marketing/pages/landing.html",
        "marketing/pages/planos.html",
        "marketing/pages/sobre-nos.html",
        "marketing/pages/manuais.html",
        "marketing/pages/blog.html",
      ],
    },
  },
});
