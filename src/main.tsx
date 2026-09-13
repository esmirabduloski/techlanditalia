import { ViteReactSSG } from "vite-react-ssg";
import { routes } from "./routes";
import { isNonPrerenderedPath } from "./lib/prerender";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./index.css";

// Le aree private (/admin, /area-riservata, /insegnante, ...) non sono prerenderate:
// l'hosting statico le serve con il fallback index.html, che però contiene l'HTML
// della HOME prerenderata (con data-server-rendered=true). vite-react-ssg vedrebbe
// quel marker e tenterebbe hydrateRoot() del markup della home mentre il router
// costruisce la pagina privata -> "Hydration failed" (eventi Sentry).
// Qui azzeriamo marker + markup così la libreria fa un render client pulito.
if (!import.meta.env.SSR && typeof document !== "undefined") {
  if (isNonPrerenderedPath(window.location.pathname)) {
    document
      .querySelectorAll("[data-server-rendered]")
      .forEach((el) => el.removeAttribute("data-server-rendered"));
    const root = document.getElementById("root");
    if (root) root.innerHTML = "";
  }
}


// Guardia SSR: durante il prerendering (Node + jsdom mock, vedi ssgOptions.mock
// in vite.config.ts) non c'è un vero browser, quindi Sentry va inizializzato
// solo lato client.
if (!import.meta.env.SSR && typeof window !== "undefined") {
  // Sentry è utile, ma non deve competere con la prima schermata sui telefoni:
  // lo carichiamo solo dopo il load e durante un momento libero.
  const initializeMonitoring = () => {
    const idle: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number =
      typeof window.requestIdleCallback === "function"
        ? (callback, options) => window.requestIdleCallback(callback, options)
        : (callback) =>
            window.setTimeout(
              () => callback({ didTimeout: false, timeRemaining: () => 0 }),
              2000,
            );

    idle(async () => {
      // Import nominali via src/lib/sentry: il namespace intero non è tree-shakabile.
      const { initSentry } = await import("./lib/sentry");
      initSentry();
    }, { timeout: 4000 });
  };

  if (document.readyState === "complete") initializeMonitoring();
  else window.addEventListener("load", initializeMonitoring, { once: true });
}

// Entry unico client + SSG: in build genera l'HTML statico delle route
// pubbliche (vedi ssgOptions in vite.config.ts), nel browser monta la SPA.
export const createRoot = ViteReactSSG({ routes });
