import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

// Deploy: o nitro detecta a Vercel pelas variáveis de ambiente do build e gera
// `.vercel/output`. Fora da Vercel (build local), gera um servidor Node em `.output`.
export default defineConfig(({ command }) => ({
  server: { host: "::", port: 8080 },
  // Testes de unidade ficam em src/; e2e/ é do Playwright (bun run e2e).
  test: { exclude: [...configDefaults.exclude, "e2e/**"] },
  css: { transformer: "lightningcss" },
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // src/server.ts envolve o handler do TanStack Start com a página de erro de SSR.
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    ...(command === "build" ? [nitro()] : []),
    viteReact(),
  ],
}));
