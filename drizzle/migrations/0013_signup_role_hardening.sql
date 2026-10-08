-- Il ruolo del profilo non arriva più dai metadati della registrazione.
--
-- Prima il trigger copiava `raw_user_meta_data.role`, che il client sceglie
-- liberamente con supabase.auth.signUp({ options: { data: { role: 'parent' } } }).
-- Il trigger anti-escalation non scatta (auth.uid() è NULL durante la signup),
-- quindi chiunque poteva diventare "genitore" e usare create-child-account per
-- iscrivere un figlio a qualsiasi corso senza pagare.
--
-- Ora ogni nuovo utente nasce "student". Genitori e docenti vengono creati da
-- admin-create-user, che imposta il ruolo con un upsert esplicito sul profilo.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'full_name', 'Utente'),
    'student',
    new.email
  );
  RETURN new;
END;
$$;
