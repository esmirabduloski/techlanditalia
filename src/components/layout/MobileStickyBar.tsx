import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";

/**
 * Sticky bottom bar shown only on mobile with the primary CTA
 * "Prima lezione gratuita". Hidden on reserved/admin/teacher/auth areas
 * and on the /prenota page itself to avoid redundancy.
 */
export function MobileStickyBar() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show only after the user scrolls past the hero area (~600px),
    // so it doesn't overlap the primary CTA already visible on load.
    const threshold = 600;
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

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

  // Quando è nascosta va tolta anche dall'ordine di tabulazione, non solo dallo
  // screen reader: `aria-hidden` da solo lasciava un link focusabile invisibile
  // (Lighthouse: "[aria-hidden=true] contiene discendenti focusabili").
  // `inert` non è ancora tipizzato in React 18: lo passiamo come attributo grezzo.
  const inertProps = visible ? {} : ({ inert: "" } as Record<string, string>);

  return (
    <div
      {...inertProps}
      className={`md:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 bg-background/95 backdrop-blur border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.08)] transition-all duration-300 ${visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"}`}
      role="complementary"
      aria-label="Prenotazione rapida"
      aria-hidden={!visible}
    >
      <Link
        to="/prenota"
        tabIndex={visible ? undefined : -1}
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
