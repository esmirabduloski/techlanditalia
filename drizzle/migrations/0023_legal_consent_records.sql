-- Registro dei consensi: chi ha accettato quale versione di Privacy e Termini,
-- quando e per quale figlio. Sotto i 14 anni (art. 8 GDPR, art. 2-quinquies
-- D.Lgs. 196/2003) per il minore accetta il genitore.
--
-- Quando cambi il testo di /privacy o /termini aggiungi qui sotto (in una nuova
-- migrazione) una riga in legal_document_versions: l'area riservata chiederà di
-- nuovo l'accettazione a tutti i genitori, per ogni figlio.

CREATE TABLE IF NOT EXISTS public.legal_document_versions (
  document text NOT NULL CHECK (document IN ('privacy', 'terms')),
  version text NOT NULL,
  published_at date NOT NULL,
  url text NOT NULL,
  PRIMARY KEY (document, version)
);

ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.legal_document_versions TO authenticated;
GRANT ALL ON public.legal_document_versions TO service_role;

DROP POLICY IF EXISTS "Authenticated read legal document versions" ON public.legal_document_versions;
CREATE POLICY "Authenticated read legal document versions"
ON public.legal_document_versions FOR SELECT TO authenticated USING (true);

INSERT INTO public.legal_document_versions (document, version, published_at, url) VALUES
  ('privacy', '2026-10-11', '2026-10-11', '/privacy'),
  ('terms',   '2026-10-11', '2026-10-11', '/termini')
ON CONFLICT DO NOTHING;

-- Prova dell'accettazione: niente FK verso auth.users e copia di nomi ed email,
-- così la prova sopravvive alla cancellazione dell'account (art. 17.3.e GDPR,
-- conservazione 10 anni come i dati contrattuali).
CREATE TABLE IF NOT EXISTS public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accepted_by uuid NOT NULL,
  accepted_by_name text,
  accepted_by_email text,
  -- NULL = il genitore accetta per sé; altrimenti il figlio per cui accetta
  subject_id uuid,
  subject_name text,
  capacity text NOT NULL CHECK (capacity IN ('self', 'parent_for_child')),
  document text NOT NULL,
  version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text,
  FOREIGN KEY (document, version) REFERENCES public.legal_document_versions(document, version),
  CONSTRAINT consent_subject_capacity CHECK ((capacity = 'self') = (subject_id IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_consent_records_accepted_by ON public.consent_records(accepted_by);
CREATE INDEX IF NOT EXISTS idx_consent_records_subject ON public.consent_records(subject_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_accepted_at ON public.consent_records(accepted_at DESC);

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
-- Si scrive solo tramite record_legal_consents(): nessun INSERT/UPDATE/DELETE dal client.
GRANT SELECT ON public.consent_records TO authenticated;
GRANT ALL ON public.consent_records TO service_role;

DROP POLICY IF EXISTS "Parents read own consent records" ON public.consent_records;
CREATE POLICY "Parents read own consent records"
ON public.consent_records FOR SELECT TO authenticated
USING (accepted_by = auth.uid());

DROP POLICY IF EXISTS "Admins read consent records" ON public.consent_records;
CREATE POLICY "Admins read consent records"
ON public.consent_records FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Una prova non si modifica: blocca gli UPDATE anche per il service role.
CREATE OR REPLACE FUNCTION public.consent_records_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'consent_records è in sola aggiunta';
END;
$$;

DROP TRIGGER IF EXISTS consent_records_no_update ON public.consent_records;
CREATE TRIGGER consent_records_no_update
BEFORE UPDATE ON public.consent_records
FOR EACH ROW EXECUTE FUNCTION public.consent_records_immutable();

-- Cosa manca al genitore corrente: per sé e per ogni figlio, l'ultima versione
-- di ogni documento non ancora accettata. Vuoto per chi non è genitore.
CREATE OR REPLACE FUNCTION public.pending_legal_consents()
RETURNS TABLE (subject_id uuid, subject_name text, document text, version text, published_at date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT p.id FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'parent' AND public.mfa_ok()
  ),
  latest AS (
    SELECT DISTINCT ON (d.document) d.document, d.version, d.published_at
    FROM public.legal_document_versions d
    ORDER BY d.document, d.published_at DESC, d.version DESC
  ),
  subjects AS (
    SELECT NULL::uuid AS subject_id, NULL::text AS subject_name FROM me
    UNION ALL
    SELECT c.id, c.full_name FROM public.profiles c JOIN me ON c.parent_id = me.id
  )
  SELECT s.subject_id, s.subject_name, l.document, l.version, l.published_at
  FROM subjects s CROSS JOIN latest l
  WHERE NOT EXISTS (
    SELECT 1 FROM public.consent_records r
    WHERE r.accepted_by = auth.uid()
      AND r.subject_id IS NOT DISTINCT FROM s.subject_id
      AND r.document = l.document
      AND r.version = l.version
  )
  ORDER BY s.subject_id NULLS FIRST, s.subject_name, l.document
$$;
REVOKE ALL ON FUNCTION public.pending_legal_consents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pending_legal_consents() TO authenticated;

-- Registra esattamente le voci mostrate al genitore ([{subject_id, document, version}]).
-- Accetta solo voci ancora in sospeso per lui: niente versioni vecchie o figli altrui.
CREATE OR REPLACE FUNCTION public.record_legal_consents(_items jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  _ip text := nullif(trim(split_part(coalesce(_headers->>'x-forwarded-for', _headers->>'cf-connecting-ip', ''), ',', 1)), '');
  _ua text := left(_headers->>'user-agent', 500);
  _parent public.profiles%ROWTYPE;
  _wanted integer;
  _inserted integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Non autenticato' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _parent FROM public.profiles WHERE id = _uid;
  IF _parent.role IS DISTINCT FROM 'parent' OR NOT public.mfa_ok() THEN
    RAISE EXCEPTION 'Solo i genitori possono registrare il consenso' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Nessuna voce da registrare' USING ERRCODE = '22023';
  END IF;

  WITH wanted AS (
    SELECT DISTINCT nullif(i->>'subject_id', '')::uuid AS subject_id, i->>'document' AS document, i->>'version' AS version
    FROM jsonb_array_elements(_items) i
  )
  SELECT count(*) INTO _wanted FROM wanted;

  WITH wanted AS (
    SELECT DISTINCT nullif(i->>'subject_id', '')::uuid AS subject_id, i->>'document' AS document, i->>'version' AS version
    FROM jsonb_array_elements(_items) i
  ),
  ok AS (
    SELECT p.* FROM public.pending_legal_consents() p
    JOIN wanted w
      ON w.subject_id IS NOT DISTINCT FROM p.subject_id
     AND w.document = p.document
     AND w.version = p.version
  )
  INSERT INTO public.consent_records
    (accepted_by, accepted_by_name, accepted_by_email, subject_id, subject_name, capacity, document, version, ip, user_agent)
  SELECT _uid, _parent.full_name, _parent.email, ok.subject_id, ok.subject_name,
         CASE WHEN ok.subject_id IS NULL THEN 'self' ELSE 'parent_for_child' END,
         ok.document, ok.version, _ip, _ua
  FROM ok;
  GET DIAGNOSTICS _inserted = ROW_COUNT;

  IF _inserted <> _wanted THEN
    RAISE EXCEPTION 'Le versioni mostrate non sono più quelle in vigore: ricarica la pagina' USING ERRCODE = '22023';
  END IF;
  RETURN _inserted;
END;
$$;
REVOKE ALL ON FUNCTION public.record_legal_consents(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_legal_consents(jsonb) TO authenticated;

-- Nuove tabelle: anche qui serve la 2FA (vedi 0020_mfa_two_factor_enable)
SELECT public.ensure_mfa_policies();
