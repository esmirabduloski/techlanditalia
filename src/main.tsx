import * as Sentry from "@sentry/react";
import { ViteReactSSG } from "vite-react-ssg";
import { routes } from "./routes";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./index.css";

// Guardia SSR: durante il prerendering (Node + jsdom mock, vedi ssgOptions.mock
// in vite.config.ts) non c'è un vero browser, quindi Sentry va inizializzato
// solo lato client.
if (!import.meta.env.SSR) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 1.0,
    tracePropagationTargets: ["localhost", /^https:\/\/[a-z0-9-]+\.supabase\.co\/functions/],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

// Entry unico client + SSG: in build genera l'HTML statico delle route
// pubbliche (vedi ssgOptions in vite.config.ts), nel browser monta la SPA.
export const createRoot = ViteReactSSG({ routes });
