import { ViteReactSSG } from "vite-react-ssg";
import { routes } from "./routes";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./index.css";

// Entry unico client + SSG: in build genera l'HTML statico delle route
// pubbliche (vedi ssgOptions in vite.config.ts), nel browser monta la SPA.
export const createRoot = ViteReactSSG({ routes });
