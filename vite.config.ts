import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import type {} from "vite-react-ssg"; // augmentation di UserConfig.ssgOptions
// Fonte unica di verità, condivisa con src/main.tsx (guardia anti-hydration).
// /lp/ escluse di proposito: sono noindex (keyword cannibalization, vedi SEO_AUDIT_2026.md SEO-006).
import { NO_PRERENDER_PREFIXES } from "./src/lib/prerender";


// https://vitejs.dev/config/
export default defineConfig(({ mode, isSsrBuild }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mcpPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  ssgOptions: {
    entry: "src/main.tsx",
    // Mock dei globals browser (window/document/localStorage via jsdom) durante il render SSG:
    // necessario perché il client Supabase auto-generato referenzia localStorage a livello di modulo.
    mock: true,
    // /corsi -> dist/corsi/index.html: gli host statici la servono nativamente per /corsi
    dirStyle: "nested",
    includedRoutes(paths) {
      return paths.filter((raw) => {
        // vite-react-ssg passa i path figli senza slash iniziale: normalizza prima di confrontare
        const p = raw.startsWith("/") ? raw : `/${raw}`;
        return (
          // niente pattern dinamici non espansi da getStaticPaths, né catch-all
          !p.includes(":") &&
          !p.includes("*") &&
          !NO_PRERENDER_PREFIXES.some((pre) => p === pre || p.startsWith(`${pre}/`))
        );
      });
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: isSsrBuild ? {} : {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-popover', '@radix-ui/react-tooltip', '@radix-ui/react-dropdown-menu', '@radix-ui/react-navigation-menu', '@radix-ui/react-toast', '@radix-ui/react-accordion', '@radix-ui/react-tabs'],
        },
      },
    },
  },
}));
