import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Logga le visite alle pagine admin (deduplica per path nello stesso minuto)
 * e le azioni sensibili manuali tramite logAdminAction().
 */
export function useAdminAccessLog() {
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const lastLoggedRef = useRef<string>("");

  useEffect(() => {
    if (!user || !isAdmin) return;
    if (!location.pathname.startsWith("/admin")) return;
    const key = `${location.pathname}-${Math.floor(Date.now() / 60000)}`;
    if (lastLoggedRef.current === key) return;
    lastLoggedRef.current = key;
    supabase.from("admin_access_logs").insert({
      admin_id: user.id,
      action: "view_page",
      path: location.pathname,
      user_agent: navigator.userAgent.slice(0, 500),
    }).then(({ error }) => {
      if (error) console.warn("admin_access_log insert failed", error.message);
    });
  }, [location.pathname, user, isAdmin]);
}

export async function logAdminAction(
  userId: string,
  action: string,
  metadata?: Record<string, any>,
  path?: string
) {
  await supabase.from("admin_access_logs").insert({
    admin_id: userId,
    action,
    path: path || (typeof window !== "undefined" ? window.location.pathname : null),
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    metadata: metadata || {},
  });
}
