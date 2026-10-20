/**
 * Calendario delle lezioni dell'insegnante (iCalendar) per Google Calendar,
 * Apple Calendar e Outlook.
 *
 * GET /functions/v1/teacher-calendar-feed/<token>.ics
 *
 * Il calendario lo scaricano i server di Google senza account: il token segreto
 * nel link (teacher_calendar_feeds, migrazione 0067) è l'unica credenziale.
 * L'insegnante lo crea e lo rigenera dalla dashboard con
 * teacher_calendar_feed(); un link rigenerato, o di chi non è più insegnante,
 * risponde 404. Il formato è in _shared/teachercalendar.ts.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureServerError } from "../_shared/sentry.ts";
import { buildTeacherCalendar, tokenFromUrl } from "../_shared/teachercalendar.ts";
import { isTeacher, loadTeacherLessons } from "../_shared/teacherlessons.ts";

const FN = "teacher-calendar-feed";

const text = (status: number, body: string) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "GET" && req.method !== "HEAD") return text(405, "Metodo non consentito");

  const token = tokenFromUrl(req.url);
  if (!token) return text(404, "Calendario non trovato");

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: feed, error: feedError } = await supabase
      .from("teacher_calendar_feeds")
      .select("teacher_id")
      .eq("token", token)
      .maybeSingle();
    if (feedError) throw feedError;
    if (!feed) return text(404, "Calendario non trovato");

    if (!(await isTeacher(supabase, feed.teacher_id))) return text(404, "Calendario non trovato");

    const { groups, lessons } = await loadTeacherLessons(supabase, feed.teacher_id, new Date());

    // Per mostrare all'insegnante che il calendario è collegato
    const { error: touchError } = await supabase
      .from("teacher_calendar_feeds")
      .update({ last_fetched_at: new Date().toISOString() })
      .eq("teacher_id", feed.teacher_id);
    if (touchError) console.warn(`[${FN}] last_fetched_at:`, touchError.message);

    const siteUrl = Deno.env.get("SITE_URL") || "https://techlanditalia.it";
    const body = buildTeacherCalendar(groups, lessons, siteUrl);
    return new Response(req.method === "HEAD" ? null : body, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="techland-lezioni.ics"',
        "Cache-Control": "private, max-age=300",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    await captureServerError(error, { fn: FN });
    return text(500, "Calendario non disponibile, riprova più tardi");
  }
});
