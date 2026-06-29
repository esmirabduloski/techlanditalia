
-- 1. referral_code on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_idx ON public.profiles (referral_code) WHERE referral_code IS NOT NULL;

-- Backfill: generate codes for all existing parents that don't have one
DO $$
DECLARE
  r RECORD;
  new_code text;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE role = 'parent' AND referral_code IS NULL LOOP
    LOOP
      new_code := upper(substr(encode(gen_random_bytes(6), 'base64'), 1, 8));
      new_code := regexp_replace(new_code, '[^A-Z0-9]', 'X', 'g');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = new_code);
    END LOOP;
    UPDATE public.profiles SET referral_code = new_code WHERE id = r.id;
  END LOOP;
END $$;

-- Trigger: auto-generate code when a parent profile is created/updated to role=parent
CREATE OR REPLACE FUNCTION public.ensure_parent_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
BEGIN
  IF NEW.role = 'parent' AND (NEW.referral_code IS NULL OR NEW.referral_code = '') THEN
    LOOP
      new_code := upper(substr(encode(gen_random_bytes(6), 'base64'), 1, 8));
      new_code := regexp_replace(new_code, '[^A-Z0-9]', 'X', 'g');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = new_code);
    END LOOP;
    NEW.referral_code := new_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_parent_referral_code_trigger ON public.profiles;
CREATE TRIGGER ensure_parent_referral_code_trigger
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_parent_referral_code();

-- 2. referrals table
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referrer_code text NOT NULL,
  referred_email text,
  referred_lead_id uuid,
  referred_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','qualified','rewarded','rejected')),
  source_url text,
  notes text,
  reward_reason text,
  rewarded_at timestamptz,
  rewarded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_referrals_referrer ON public.referrals (referrer_id, status);
CREATE INDEX idx_referrals_status ON public.referrals (status, created_at DESC);
CREATE INDEX idx_referrals_email ON public.referrals (lower(referred_email));

GRANT SELECT ON public.referrals TO authenticated;
GRANT INSERT ON public.referrals TO anon, authenticated;
GRANT UPDATE, DELETE ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Parents see their own referrals
CREATE POLICY "Referrer reads own"
  ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid());

-- Admins read all
CREATE POLICY "Admins read all referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Anonymous/anyone can insert (tracked via referrer_code); validation happens server-side via trigger
CREATE POLICY "Anyone can submit referral"
  ON public.referrals FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Admins manage
CREATE POLICY "Admins update referrals"
  ON public.referrals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete referrals"
  ON public.referrals FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Validate insert: referrer_code must match an existing parent; set referrer_id from it
CREATE OR REPLACE FUNCTION public.validate_referral_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_id uuid;
BEGIN
  IF NEW.referrer_code IS NULL OR length(NEW.referrer_code) < 4 THEN
    RAISE EXCEPTION 'Codice referral non valido';
  END IF;

  SELECT id INTO matched_id
  FROM public.profiles
  WHERE referral_code = upper(NEW.referrer_code) AND role = 'parent'
  LIMIT 1;

  IF matched_id IS NULL THEN
    RAISE EXCEPTION 'Codice referral inesistente';
  END IF;

  NEW.referrer_id := matched_id;
  NEW.referrer_code := upper(NEW.referrer_code);
  NEW.status := 'pending';
  NEW.rewarded_at := NULL;
  NEW.rewarded_by := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_referral_insert_trigger ON public.referrals;
CREATE TRIGGER validate_referral_insert_trigger
  BEFORE INSERT ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.validate_referral_insert();

CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Admin function to reward a referral: credits both referrer and referred student(s)
CREATE OR REPLACE FUNCTION public.reward_referral(
  _referral_id uuid,
  _credits_each integer DEFAULT 1,
  _reason text DEFAULT 'Referral pagante'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  referrer_child_id uuid;
  current_bal integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Solo admin';
  END IF;

  SELECT * INTO r FROM public.referrals WHERE id = _referral_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referral non trovato';
  END IF;
  IF r.status = 'rewarded' THEN
    RAISE EXCEPTION 'Già premiato';
  END IF;

  -- Credit referrer's children (1 credit on each, or fallback on parent if no child)
  FOR referrer_child_id IN
    SELECT id FROM public.profiles WHERE parent_id = r.referrer_id
  LOOP
    SELECT lesson_balance INTO current_bal FROM public.profiles WHERE id = referrer_child_id;
    UPDATE public.profiles SET lesson_balance = COALESCE(current_bal, 0) + _credits_each WHERE id = referrer_child_id;
    INSERT INTO public.lesson_balance_log (student_id, operation_type, amount, balance_before, balance_after, performed_by, notes)
    VALUES (referrer_child_id, 'credit_added', _credits_each, COALESCE(current_bal,0), COALESCE(current_bal,0) + _credits_each, auth.uid(), 'Referral: ' || _reason || ' (referrer)');
  END LOOP;

  -- Credit referred student if linked
  IF r.referred_profile_id IS NOT NULL THEN
    -- if referred_profile is a parent, credit their children; else credit directly
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = r.referred_profile_id AND role = 'parent') THEN
      FOR referrer_child_id IN
        SELECT id FROM public.profiles WHERE parent_id = r.referred_profile_id
      LOOP
        SELECT lesson_balance INTO current_bal FROM public.profiles WHERE id = referrer_child_id;
        UPDATE public.profiles SET lesson_balance = COALESCE(current_bal, 0) + _credits_each WHERE id = referrer_child_id;
        INSERT INTO public.lesson_balance_log (student_id, operation_type, amount, balance_before, balance_after, performed_by, notes)
        VALUES (referrer_child_id, 'credit_added', _credits_each, COALESCE(current_bal,0), COALESCE(current_bal,0) + _credits_each, auth.uid(), 'Referral: ' || _reason || ' (nuovo iscritto)');
      END LOOP;
    ELSE
      SELECT lesson_balance INTO current_bal FROM public.profiles WHERE id = r.referred_profile_id;
      UPDATE public.profiles SET lesson_balance = COALESCE(current_bal, 0) + _credits_each WHERE id = r.referred_profile_id;
      INSERT INTO public.lesson_balance_log (student_id, operation_type, amount, balance_before, balance_after, performed_by, notes)
      VALUES (r.referred_profile_id, 'credit_added', _credits_each, COALESCE(current_bal,0), COALESCE(current_bal,0) + _credits_each, auth.uid(), 'Referral: ' || _reason || ' (nuovo iscritto)');
    END IF;
  END IF;

  UPDATE public.referrals
  SET status = 'rewarded',
      reward_reason = _reason,
      rewarded_at = now(),
      rewarded_by = auth.uid()
  WHERE id = _referral_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reward_referral(uuid, integer, text) FROM public;
GRANT EXECUTE ON FUNCTION public.reward_referral(uuid, integer, text) TO authenticated;
