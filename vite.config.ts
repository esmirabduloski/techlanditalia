import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import type {} from "vite-react-ssg"; // augmentation di UserConfig.ssgOptions
// Fonte unica di verità, condivisa con src/main.tsx (guardia anti-hydration).
// /lp/ escluse di proposito: sono noindex (keyword cannibalization, vedi SEO_AUDIT_2026.md SEO-006).
import { NO_PRERENDER_PREFIXES } from "./src/lib/prerender";


/**
 * Fa partire il JavaScript dell'app solo DOPO il primo frame dipinto.
 *
 * Vite emette `<script type="module" src="/assets/app-*.js">` nell'head: il modulo
 * è deferred ma, essendo già precaricato, Chrome lo esegue appena finisce il parsing
 * e PRIMA del primo paint (trace: DOMContentLoaded 521 ms -> primo paint 534 ms).
 * Così Lighthouse/PageSpeed contano download ed esecuzione di ~230 KB di JS dentro
 * FCP e LCP anche se l'HTML prerenderato era pronto da subito.
 *
 * Qui il tag viene sostituito da un `modulepreload` (il download parte comunque
 * subito) più un piccolo loader inline che inserisce lo script al frame successivo
 * a DOMContentLoaded, cioè dopo che l'HTML statico è stato mostrato. Sulle route
 * NON prerenderate (aree private, servite col fallback index.html) il caricamento è
 * immediato: lì main.tsx svuota #root e non c'è nulla da mostrare prima del JS.
 *
 * Inoltre tutti i `modulepreload` ricevono fetchpriority="low": Lantern (il
 * simulatore di Lighthouse/PageSpeed) include nel calcolo di FCP e LCP ogni
 * richiesta High/VeryHigh iniziata prima del primo paint, quindi ~230 KB di JS
 * finivano dentro l'FCP anche se eseguiti dopo. Per una pagina prerenderata il JS
 * è davvero meno urgente di CSS e font: con priorità bassa il browser dà loro la
 * banda per primi (paint prima anche sul telefono) e continua a scaricare il JS
 * in parallelo.
 */
function deferEntryModule(): Plugin {
  const prefixes = JSON.stringify(NO_PRERENDER_PREFIXES);
  const loader = (src: string) =>
    `(function(){var src=${JSON.stringify(src)};` +
    `function load(){var s=document.createElement("script");s.type="module";s.crossOrigin="";s.src=src;document.head.appendChild(s)}` +
    `var p=location.pathname,priv=${prefixes}.some(function(x){return p===x||p.indexOf(x+"/")===0});` +
    `if(priv||typeof requestAnimationFrame!=="function"){load();return}` +
    `var done=false;function go(){if(!done){done=true;load()}}` +
    `function schedule(){if(document.visibilityState==="hidden"||!document.querySelector("[data-server-rendered]")){go();return}` +
    `requestAnimationFrame(function(){setTimeout(go,0)});setTimeout(go,500)}` +
    `if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",schedule)}else{schedule()}})();`;
  return {
    name: "techland:defer-entry-module",
    apply: (_config, env) => env.command === "build" && !env.isSsrBuild,
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        // Preload dei tre pesi latin del font (h1 bold, bottoni semibold, testo 400):
        // senza preload il browser li scopre solo dopo aver scaricato e parsato il
        // CSS (un round trip in più sul percorso critico dell'LCP, che è testo).
        const fontLinks = Object.keys(ctx.bundle ?? {})
          .filter((f) => /plus-jakarta-sans-latin-(400|600|700)-normal-[^/]+\.woff2$/.test(f))
          .sort()
          .map((f) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="/${f}">`)
          .join("");
        return html
          .replace(/<link rel="stylesheet"/, `${fontLinks}<link rel="stylesheet"`)
          .replace(
            /<script type="module" crossorigin(?:="")? src="([^"]+)"><\/script>/,
            (_match, src: string) =>
              `<link rel="modulepreload" crossorigin href="${src}"><script>${loader(src)}</script>`,
          )
          .replace(/<link rel="modulepreload"(?![^>]*fetchpriority)/g, '<link rel="modulepreload" fetchpriority="low"');
      },
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode, isSsrBuild }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mcpPlugin(), deferEntryModule(), mode === "development" && componentTagger()].filter(Boolean),
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
    // I loghi dei corsi (src/assets/logos) sono piccoli ma ripetuti molte volte
    // nell'HTML prerenderato: meglio un file cacheable che un data URI duplicato.
    assetsInlineLimit: (filePath) => (filePath.includes("/assets/logos/") ? false : undefined),
    rollupOptions: {
      output: isSsrBuild ? {} : {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          // tslib è condiviso da supabase-js e da Radix (react-remove-scroll): senza un
          // chunk proprio Rollup lo mette in vendor-supabase e vendor-ui finisce per
          // importare tutto Supabase anche sulle pagine pubbliche che non lo usano.
          'vendor-tslib': ['tslib'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-popover', '@radix-ui/react-tooltip', '@radix-ui/react-dropdown-menu', '@radix-ui/react-navigation-menu', '@radix-ui/react-toast', '@radix-ui/react-accordion', '@radix-ui/react-tabs'],
        },
      },
    },
  },
}));
