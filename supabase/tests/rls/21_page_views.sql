-- Visite del sito (page_views), scritte da src/components/analytics/AnalyticsProvider.tsx.
-- Gira come supabase_admin sul database usa-e-getta e prova la tabella come i vari utenti:
--   - anonimi e utenti loggati registrano la visita con un INSERT che non chiede la
--     riga indietro (id generato nel browser);
--   - per l'anonimo con RETURNING l'INSERT viene rifiutato: non legge le visite
--     (è il motivo del 401 su ogni pagina quando il client usava .select('id'));
--   - l'admin legge tutte le visite; l'utente loggato solo le proprie delle ultime
--     2 ore (0073), quanto basta per chiuderle;
--   - l'utente loggato chiude la propria visita (tempo sulla pagina, scroll), non
--     quelle degli altri né le proprie più vecchie di 2 ore;
--   - gli anonimi non modificano le visite, nemmeno le proprie.
-- Dati di partenza (01_seed.sql): P1 genitore, ADM admin con 2FA.

-- Errore del comando eseguito come _role (anon o authenticated con _uid):
-- NULL se è riuscito, 'nessuna riga' se l'RLS non gli ha fatto toccare nulla.
CREATE FUNCTION pg_temp.run_as(_role text, _uid uuid, _aal text, _sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', _role, 'aal', _aal)::text, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(_uid::text, ''), true);
  EXECUTE format('SET LOCAL ROLE %I', _role);
  EXECUTE _sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN CASE WHEN n = 0 THEN 'nessuna riga' END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN SQLERRM;
END $$;

-- Righe visibili all'utente
CREATE FUNCTION pg_temp.count_as(_role text, _uid uuid, _aal text) RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', _role, 'aal', _aal)::text, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(_uid::text, ''), true);
  EXECUTE format('SET LOCAL ROLE %I', _role);
  SELECT count(*) INTO n FROM public.page_views;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN n;
END $$;

DO $$
DECLARE
  p1 constant uuid := '00000000-0000-0000-0000-000000000201';
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  anon_view constant uuid := '00000000-0000-0000-0000-00000000a001';
  p1_view constant uuid := '00000000-0000-0000-0000-00000000a002';
  p1_old_view constant uuid := '00000000-0000-0000-0000-00000000a003';
  err text;
BEGIN
  DELETE FROM public.page_views;

  -- L'anonimo registra la visita come fa il sito: id suo, niente RETURNING
  err := pg_temp.run_as('anon', NULL, NULL, format(
    'INSERT INTO public.page_views (id, page_url, session_id, entered_at) VALUES (%L, %L, %L, now())',
    anon_view, '/', 'sess_1792594849_anon01'));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'page_views: l''anonimo non registra la visita (%)', err; END IF;

  -- Con RETURNING (il vecchio .select('id')) l'INSERT viene rifiutato
  err := pg_temp.run_as('anon', NULL, NULL, format(
    'INSERT INTO public.page_views (page_url, session_id) VALUES (%L, %L) RETURNING id', '/corsi', 'sess_1792594849_anon01'));
  IF err IS NULL THEN
    RAISE EXCEPTION 'page_views: INSERT ... RETURNING riuscito per l''anonimo: il client può tornare a usare .select()';
  END IF;

  -- Il genitore loggato registra la sua visita
  err := pg_temp.run_as('authenticated', p1, 'aal1', format(
    'INSERT INTO public.page_views (id, page_url, session_id, user_id, entered_at) VALUES (%L, %L, %L, %L, now())',
    p1_view, '/area-riservata', 'sess_1792594849_p1abcd', p1));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'page_views: il genitore non registra la visita (%)', err; END IF;

  IF (SELECT count(*) FROM public.page_views) <> 2 THEN
    RAISE EXCEPTION 'page_views: attese 2 visite registrate, trovate %', (SELECT count(*) FROM public.page_views);
  END IF;

  -- Una visita del genitore di ieri, scritta direttamente (fuori dalla finestra di 2 ore)
  INSERT INTO public.page_views (id, page_url, session_id, user_id, entered_at)
  VALUES (p1_old_view, '/area-riservata', 'sess_1792508449_p1old0', p1, now() - interval '1 day');

  -- L'admin legge tutto, il genitore solo la propria visita recente, l'anonimo niente
  IF pg_temp.count_as('anon', NULL, NULL) <> 0 THEN RAISE EXCEPTION 'page_views: l''anonimo legge le visite'; END IF;
  IF pg_temp.count_as('authenticated', p1, 'aal1') <> 1 THEN
    RAISE EXCEPTION 'page_views: il genitore vede % visite invece della sola propria recente',
      pg_temp.count_as('authenticated', p1, 'aal1');
  END IF;
  IF pg_temp.count_as('authenticated', adm, 'aal2') <> 3 THEN RAISE EXCEPTION 'page_views: l''admin non vede le visite'; END IF;

  -- Il genitore chiude la propria visita, come fa il sito alla pagina successiva
  err := pg_temp.run_as('authenticated', p1, 'aal1', format(
    'UPDATE public.page_views SET time_on_page = 42, scroll_depth = 80, exited_at = now() WHERE id = %L', p1_view));
  IF err IS NOT NULL THEN RAISE EXCEPTION 'page_views: il genitore non chiude la propria visita (%)', err; END IF;
  IF (SELECT time_on_page FROM public.page_views WHERE id = p1_view) IS DISTINCT FROM 42 THEN
    RAISE EXCEPTION 'page_views: il tempo sulla pagina del genitore non è stato salvato';
  END IF;

  -- ...ma non quella di ieri
  err := pg_temp.run_as('authenticated', p1, 'aal1', format(
    'UPDATE public.page_views SET time_on_page = 999 WHERE id = %L', p1_old_view));
  IF err IS DISTINCT FROM 'nessuna riga' THEN
    RAISE EXCEPTION 'page_views: il genitore ha modificato una sua visita vecchia (%)', coalesce(err, 'riuscito');
  END IF;

  -- L'anonimo non modifica le visite, nemmeno la sua
  err := pg_temp.run_as('anon', NULL, NULL, format(
    'UPDATE public.page_views SET time_on_page = 999 WHERE id = %L', anon_view));
  IF err IS NULL THEN RAISE EXCEPTION 'page_views: l''anonimo ha modificato una visita'; END IF;
  IF (SELECT time_on_page FROM public.page_views WHERE id = anon_view) IS NOT NULL THEN
    RAISE EXCEPTION 'page_views: la visita anonima è stata modificata';
  END IF;

  -- Il genitore non modifica le visite degli altri
  err := pg_temp.run_as('authenticated', p1, 'aal1', format(
    'UPDATE public.page_views SET time_on_page = 999 WHERE id = %L', anon_view));
  IF err IS DISTINCT FROM 'nessuna riga' THEN
    RAISE EXCEPTION 'page_views: il genitore ha modificato la visita di un altro (%)', coalesce(err, 'riuscito');
  END IF;

  RAISE NOTICE 'Visite del sito: registrazione senza RETURNING e chiusura della propria visita ok';
END $$;
