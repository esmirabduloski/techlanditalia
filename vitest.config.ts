import { defineConfig } from "vitest/config";
import path from "path";

// Configurazione separata da vite.config.ts: lì ci sono i plugin di build
// (Lovable, SSG, MCP) che ai test non servono e rigenerano file.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "supabase/functions/_shared/**/*.test.ts"],
  },
});
