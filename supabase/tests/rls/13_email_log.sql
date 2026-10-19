-- Registro delle email inviate (drizzle/migrations/0057_email_log.sql).
-- Gira come supabase_admin sul database usa-e-getta e prova la tabella come i vari utenti
-- (le righe del seed, source = 'seed', non contano):
--   - l'admin con 2FA legge tutte le righe, senza 2FA nessuna;
--   - genitori, alunni e insegnanti non leggono nulla, nemmeno le email ricevute;
--   - nessuno scrive dal client (scrive solo il service role delle edge function);
--   - le righe spariscono con l'account del destinatario;
--   - cleanup_old_logs cancella le righe più vecchie di 12 mesi.

CREATE FUNCTION pg_temp.count_as(_uid uuid, _aal text) RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated', 'aal', _aal)::text, true);
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.email_log WHERE source <> 'seed';
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN n;
END $$;

-- Errore dell'insert dal client: NULL se è riuscito
CREATE FUNCTION pg_temp.insert_error_as(_uid uuid, _aal text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated', 'aal', _aal)::text, true);
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.email_log (kind, to_email, subject, status, source)
  VALUES ('payment_reminder', 'finto@test.local', 'Finta', 'sent', 'client');
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN SQLERRM;
END $$;

DO $$
DECLARE
  s1 constant uuid := '00000000-0000-0000-0000-000000000101';
  p1 constant uuid := '00000000-0000-0000-0000-000000000201';
  t1 constant uuid := '00000000-0000-0000-0000-000000000301';
  adm constant uuid := '00000000-0000-0000-0000-000000000901';
  doomed constant uuid := '00000000-0000-0000-0000-000000000777';
  n int;
BEGIN
  -- Un account da eliminare, con un'email ricevuta
  INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', doomed, 'authenticated', 'authenticated',
          'doomed@test.local', '{"full_name":"Da eliminare"}', now(), now());

  INSERT INTO public.email_log (kind, to_email, recipient_id, subject, html, status, source, created_at) VALUES
    ('pause_ending', 'p1@test.local', p1, 'Le lezioni riprendono tra 7 giorni', '<p>ciao</p>', 'sent', 'subscription-pause-check', now()),
    ('password_reset', 'p1@test.local', p1, 'Reimposta la tua password', NULL, 'sent', 'send-password-reset-email', now()),
    ('payment_overdue', 'lead@test.local', NULL, 'Pagamento da saldare', '<p>rata</p>', 'failed', 'send-payment-reminders', now()),
    ('welcome', 'doomed@test.local', doomed, 'Benvenuto', NULL, 'sent', 'send-welcome-email', now()),
    ('staff_monthly_report', 'admin@test.local', adm, 'Report vecchio', '<p>vecchio</p>', 'sent', 'monthly-report', now() - interval '13 months');

  IF pg_temp.count_as(adm, 'aal2') <> 5 THEN
    RAISE EXCEPTION 'email_log: l''admin con 2FA doveva vedere 5 righe, ne vede %', pg_temp.count_as(adm, 'aal2');
  END IF;
  IF pg_temp.count_as(adm, 'aal1') <> 0 THEN
    RAISE EXCEPTION 'email_log: l''admin senza 2FA vede il registro email';
  END IF;
  IF pg_temp.count_as(p1, 'aal1') <> 0 OR pg_temp.count_as(s1, 'aal1') <> 0 OR pg_temp.count_as(t1, 'aal2') <> 0 THEN
    RAISE EXCEPTION 'email_log: genitore, alunno o insegnante vedono il registro email';
  END IF;

  IF pg_temp.insert_error_as(adm, 'aal2') IS NULL OR pg_temp.insert_error_as(p1, 'aal1') IS NULL THEN
    RAISE EXCEPTION 'email_log: un utente ha scritto nel registro dal client';
  END IF;

  DELETE FROM auth.users WHERE id = doomed;
  SELECT count(*) INTO n FROM public.email_log WHERE to_email = 'doomed@test.local';
  IF n <> 0 THEN RAISE EXCEPTION 'email_log: le email dell''account eliminato sono rimaste'; END IF;

  PERFORM public.cleanup_old_logs();
  SELECT count(*) INTO n FROM public.email_log WHERE subject = 'Report vecchio';
  IF n <> 0 THEN RAISE EXCEPTION 'email_log: cleanup_old_logs non ha cancellato le righe oltre 12 mesi'; END IF;
  SELECT count(*) INTO n FROM public.email_log WHERE source <> 'seed';
  IF n <> 3 THEN RAISE EXCEPTION 'email_log: cleanup_old_logs ha cancellato righe recenti (restano %)', n; END IF;

  RAISE NOTICE 'Registro email: ok';
END $$;
