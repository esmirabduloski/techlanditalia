-- Colonne referral sui lead CRM
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referrer_email text,
  ADD COLUMN IF NOT EXISTS referrer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_leads_referral_code ON public.crm_leads (referral_code);
CREATE INDEX IF NOT EXISTS idx_crm_leads_referrer_id ON public.crm_leads (referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_email_lower ON public.referrals (lower(referred_email));

-- Da referral -> lead
CREATE OR REPLACE FUNCTION public.sync_referral_to_crm_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
  v_lead_id uuid;
  v_tag text;
BEGIN
  IF NEW.referred_email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = NEW.referrer_id;
  v_tag := 'Ref: ' || upper(NEW.referrer_code);

  UPDATE public.crm_leads
     SET referral_code = upper(NEW.referrer_code),
         referrer_email = COALESCE(v_email, referrer_email),
         referrer_id = NEW.referrer_id,
         tags = CASE WHEN v_tag = ANY(tags) THEN tags ELSE array_append(tags, v_tag) END,
         updated_at = now()
   WHERE lower(email) = lower(NEW.referred_email)
     AND deleted_at IS NULL
   RETURNING id INTO v_lead_id;

  IF v_lead_id IS NOT NULL AND NEW.referred_lead_id IS DISTINCT FROM v_lead_id THEN
    UPDATE public.referrals SET referred_lead_id = v_lead_id, updated_at = now() WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_referral_to_crm_lead ON public.referrals;
CREATE TRIGGER trg_sync_referral_to_crm_lead
AFTER INSERT ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.sync_referral_to_crm_lead();

-- Da lead -> referral già esistente
CREATE OR REPLACE FUNCTION public.attach_referral_to_new_crm_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_email text;
  v_tag text;
BEGIN
  IF NEW.referral_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO r
  FROM public.referrals
  WHERE lower(referred_email) = lower(NEW.email)
  ORDER BY created_at DESC
  LIMIT 1;

  IF r.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = r.referrer_id;
  v_tag := 'Ref: ' || upper(r.referrer_code);

  NEW.referral_code := upper(r.referrer_code);
  NEW.referrer_email := v_email;
  NEW.referrer_id := r.referrer_id;
  NEW.tags := CASE WHEN v_tag = ANY(COALESCE(NEW.tags, '{}'::text[])) THEN NEW.tags
                   ELSE array_append(COALESCE(NEW.tags, '{}'::text[]), v_tag) END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attach_referral_to_new_crm_lead ON public.crm_leads;
CREATE TRIGGER trg_attach_referral_to_new_crm_lead
BEFORE INSERT ON public.crm_leads
FOR EACH ROW EXECUTE FUNCTION public.attach_referral_to_new_crm_lead();

-- Collega i lead già creati
CREATE OR REPLACE FUNCTION public.link_referral_to_crm_lead_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.referral_code IS NOT NULL THEN
    UPDATE public.referrals
       SET referred_lead_id = NEW.id, updated_at = now()
     WHERE lower(referred_email) = lower(NEW.email)
       AND referred_lead_id IS DISTINCT FROM NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_referral_to_crm_lead ON public.crm_leads;
CREATE TRIGGER trg_link_referral_to_crm_lead
AFTER INSERT ON public.crm_leads
FOR EACH ROW EXECUTE FUNCTION public.link_referral_to_crm_lead_after_insert();

-- Backfill dei referral esistenti
UPDATE public.crm_leads l
   SET referral_code = upper(r.referrer_code),
       referrer_email = p.email,
       referrer_id = r.referrer_id,
       tags = CASE WHEN ('Ref: ' || upper(r.referrer_code)) = ANY(l.tags) THEN l.tags
                   ELSE array_append(l.tags, 'Ref: ' || upper(r.referrer_code)) END
  FROM public.referrals r
  LEFT JOIN public.profiles p ON p.id = r.referrer_id
 WHERE r.referred_email IS NOT NULL
   AND lower(r.referred_email) = lower(l.email)
   AND l.referral_code IS NULL;

UPDATE public.referrals r
   SET referred_lead_id = l.id
  FROM public.crm_leads l
 WHERE r.referred_email IS NOT NULL
   AND lower(r.referred_email) = lower(l.email)
   AND r.referred_lead_id IS NULL;