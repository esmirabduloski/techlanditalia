CREATE OR REPLACE FUNCTION public.ensure_parent_referral_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  new_code text;
BEGIN
  IF NEW.role = 'parent' AND (NEW.referral_code IS NULL OR NEW.referral_code = '') THEN
    LOOP
      new_code := upper(regexp_replace(replace(replace(encode(extensions.gen_random_bytes(6), 'base64'), '/', 'X'), '+', 'X'), '[^A-Z0-9]', 'X', 'g'));
      new_code := substr(new_code, 1, 8);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = new_code);
    END LOOP;
    NEW.referral_code := new_code;
  END IF;
  RETURN NEW;
END;
$function$;