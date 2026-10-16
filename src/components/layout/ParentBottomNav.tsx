import { Link, useLocation } from "react-router-dom";
import { Home, CalendarDays, CreditCard, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfileRole } from "@/hooks/useProfileRole";

const ITEMS = [
  { to: "/area-riservata", label: "Home", icon: Home, match: (p: string, h: string) => p === "/area-riservata" && h !== "#calendario" },
  { to: "/area-riservata#calendario", label: "Calendario", icon: CalendarDays, match: (p: string, h: string) => p === "/area-riservata" && h === "#calendario" },
  { to: "/area-riservata/acquisti", label: "Acquisti", icon: CreditCard, match: (p: string) => p.startsWith("/area-riservata/acquisti") },
  { to: "/area-riservata/profilo", label: "Profilo", icon: UserRound, match: (p: string) => p.startsWith("/area-riservata/profilo") },
];

/** La barra si vede solo ai genitori dentro l'area riservata (e solo sotto i 768px, via CSS). */
export function useParentBottomNavVisible() {
  const { pathname } = useLocation();
  const { isParent } = useProfileRole();
  return isParent && (pathname === "/area-riservata" || pathname.startsWith("/area-riservata/"));
}

/**
 * Barra di navigazione fissa in basso per i genitori su telefono:
 * le quattro destinazioni che usano davvero, a portata di pollice.
 */
export function ParentBottomNav() {
  const { pathname, hash } = useLocation();
  const visible = useParentBottomNavVisible();
  if (!visible) return null;

  return (
    <nav
      aria-label="Navigazione area genitori"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-4 list-none m-0 p-0">
        {ITEMS.map(({ to, label, icon: Icon, match }) => {
          const active = match(pathname, hash);
          return (
            <li key={to}>
              <Link
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-xs font-medium no-underline transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("w-5 h-5", active && "stroke-[2.5]")} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
