import { useQuery } from "@tanstack/react-query";
import { Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchChildIds } from "@/lib/familyClient";
import { fetchExtraMeetingLinks } from "@/lib/extraMeetingLinks";

interface Props {
  userId: string;
  forParent?: boolean;
}

/**
 * Il secondo link per entrare a lezione, dato dall'admin a un singolo studente
 * (Admin → Utenti) per i casi speciali, es. la lezione di un altro gruppo.
 * Sempre visibile, a prescindere dal calendario; nell'area genitore con il
 * nome del figlio. Senza link non compare niente.
 */
export function ExtraMeetingLinkButtons({ userId, forParent = false }: Props) {
  const { data: links = [] } = useQuery({
    queryKey: ["extra-meeting-links", userId, forParent],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!forParent) {
        return (await fetchExtraMeetingLinks([userId])).map((l) => ({ ...l, name: "" }));
      }
      const childIds = await fetchChildIds(supabase, userId);
      const links = await fetchExtraMeetingLinks(childIds);
      if (links.length === 0) return [];
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", links.map((l) => l.student_id));
      const names = new Map((data || []).map((c) => [c.id, c.full_name.split(" ")[0]]));
      return links.map((l) => ({ ...l, name: names.get(l.student_id) ?? "" }));
    },
  });

  if (links.length === 0) return null;

  return (
    <div className="mb-8 -mt-4 flex flex-wrap justify-center gap-3" data-testid="extra-meeting-links">
      {links.map((link) => (
        <a
          key={link.student_id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border-2 border-primary bg-background px-5 py-3 font-bold text-primary shadow-sm transition-all hover:bg-primary hover:text-primary-foreground hover:-translate-y-0.5"
        >
          <Video className="w-5 h-5 shrink-0" />
          <span className="text-left">
            Entra a lezione
            <span className="block text-sm font-semibold opacity-90">
              {link.name ? `${link.name} · ` : ""}{link.label}
            </span>
          </span>
        </a>
      ))}
    </div>
  );
}
