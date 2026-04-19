import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          // Keep React + ALL libs that import react together to avoid duplicate React copies
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/") ||
            id.includes("/react-router") ||
            id.includes("/react-helmet-async") ||
            id.includes("/next-themes") ||
            id.includes("/use-sync-external-store") ||
            id.includes("/react-is/")
          ) {
            return "vendor-react";
          }

          // Supabase: split heavy realtime/postgrest from core auth
          if (id.includes("@supabase/realtime-js")) return "vendor-supabase-realtime";
          if (id.includes("@supabase/postgrest-js")) return "vendor-supabase-postgrest";
          if (id.includes("@supabase/")) return "vendor-supabase-core";

          // Tanstack query
          if (id.includes("@tanstack/")) return "vendor-query";

          // Radix UI: split per primitive to avoid one giant chunk
          if (id.includes("@radix-ui/react-dialog") || id.includes("@radix-ui/react-alert-dialog")) {
            return "vendor-radix-dialog";
          }
          if (id.includes("@radix-ui/react-dropdown-menu") || id.includes("@radix-ui/react-context-menu") || id.includes("@radix-ui/react-menubar")) {
            return "vendor-radix-menu";
          }
          if (id.includes("@radix-ui/react-popover") || id.includes("@radix-ui/react-tooltip") || id.includes("@radix-ui/react-hover-card")) {
            return "vendor-radix-popover";
          }
          if (id.includes("@radix-ui/react-navigation-menu")) return "vendor-radix-nav";
          if (id.includes("@radix-ui/react-toast")) return "vendor-radix-toast";
          if (id.includes("@radix-ui/react-accordion") || id.includes("@radix-ui/react-tabs") || id.includes("@radix-ui/react-collapsible")) {
            return "vendor-radix-disclosure";
          }
          if (id.includes("@radix-ui/")) return "vendor-radix-misc";

          // Heavy libs: isolate so they only load when used
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("@tiptap/") || id.includes("prosemirror")) return "vendor-editor";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("embla-carousel")) return "vendor-carousel";
          if (id.includes("react-day-picker") || id.includes("date-fns")) return "vendor-date";
          if (id.includes("dompurify")) return "vendor-sanitize";
          if (id.includes("lucide-react")) return "vendor-icons";
        },
      },
    },
  },
}));
