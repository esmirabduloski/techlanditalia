import { Link, useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";

/**
 * Sticky bottom bar shown only on mobile with the primary CTA
 * "Prima lezione gratuita". Hidden on reserved/admin/teacher/auth areas
 * and on the /prenota page itself to avoid redundancy.
 */
export function MobileStickyBar() {
  const { pathname } = useLocation();

  const hiddenPrefixes = [
    "/prenota",
    "/area-riservata",
    "/admin",
    "/insegnante",
    "/auth",
    "/lp/",
  ];
  if (hiddenPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p))) {
    return null;
  }

  return (
    <div
      className="md:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 bg-background/95 backdrop-blur border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
      role="complementary"
      aria-label="Prenotazione rapida"
    >
      <Link
        to="/prenota"
        data-track-cta="mobile_sticky_prenota"
        data-track-label="Prima lezione gratuita"
        className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-gradient-cta text-primary-foreground font-semibold text-base shadow-tech-glow active:scale-[0.98] transition-transform"
      >
        <Sparkles className="w-5 h-5" aria-hidden="true" />
        Prima lezione gratuita
      </Link>
    </div>
  );
}
