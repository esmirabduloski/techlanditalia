import type { useTurnstile } from "@/hooks/useTurnstile";
import { cn } from "@/lib/utils";

/**
 * Posto del widget Turnstile nel modulo. Finché il widget è invisibile non
 * occupa spazio (niente margine dei `space-y-*` del form); quando Cloudflare
 * chiede un clic diventa un blocco centrato con la spaziatura normale.
 */
export function TurnstileSlot({
  turnstile,
  className,
}: {
  turnstile: ReturnType<typeof useTurnstile>;
  className?: string;
}) {
  return (
    <div
      ref={turnstile.containerRef}
      className={turnstile.interactive ? cn("flex justify-center", className) : "!mt-0"}
    />
  );
}
