-- Visite del sito: l'utente loggato chiude la propria visita (tempo sulla pagina, scroll).
--
-- AnalyticsProvider registra la visita con un INSERT senza RETURNING e, se l'utente
-- è loggato, alla pagina successiva aggiorna time_on_page, scroll_depth ed exited_at.
-- Quell'UPDATE c'era già come policy ("Authenticated owners can update their recent
-- page views"), ma non toccava mai nessuna riga: un UPDATE con WHERE applica anche le
-- policy SELECT, e page_views la leggevano solo gli admin. Per questo i tempi di
-- permanenza erano vuoti per tutti tranne gli admin.
--
-- Questa policy fa leggere all'utente solo le proprie visite delle ultime 2 ore,
-- la stessa finestra dell'UPDATE: niente storico di navigazione leggibile dal client.
-- Gli anonimi restano senza lettura né modifica (la vecchia policy sull'header
-- x-session-id era falsificabile).

DROP POLICY IF EXISTS "Authenticated owners can view their recent page views" ON public.page_views;
CREATE POLICY "Authenticated owners can view their recent page views"
ON public.page_views
FOR SELECT
TO authenticated
USING (
  user_id IS NOT NULL
  AND user_id = auth.uid()
  AND entered_at > (now() - interval '2 hours')
);
