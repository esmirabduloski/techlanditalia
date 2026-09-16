import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { isClarityAllowedPath, loadClarityTag } from "@/lib/clarity";

/**
 * Ferma Clarity quando l'utente entra in un'area riservata via navigazione SPA
 * (es. home → /auth → /area-riservata senza ricaricare la pagina) e lo riavvia
 * quando torna sulle pagine pubbliche. Se la prima pagina aperta era riservata
 * (il tag in index.html non si è caricato), lo carica al primo passaggio pubblico.
 */
export function ClarityGuard() {
  const { pathname } = useLocation();
  const stopped = useRef(false);

  useEffect(() => {
    if (!isClarityAllowedPath(pathname)) {
      if (window.clarity && !stopped.current) {
        window.clarity("stop");
        stopped.current = true;
      }
      return;
    }
    if (!window.clarity) {
      loadClarityTag();
    } else if (stopped.current) {
      window.clarity("start");
      stopped.current = false;
    }
  }, [pathname]);

  return null;
}
