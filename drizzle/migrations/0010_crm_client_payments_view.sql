-- Area riservata: il cliente vede le proprie rate (pagate e da pagare).
-- Funzione SECURITY DEFINER che restituisce solo i campi pubblici: niente note
-- interne né dati dei promemoria. Nessuna policy aggiunta su crm_payments.
CREATE OR REPLACE FUNCTION public.get_my_crm_payments()
RETURNS TABLE (
  id uuid,
  amount_cents integer,
  status text,
  description text,
  due_date date,
  paid_at date,
  method text,
  installment_number integer,
  installment_total integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.amount_cents, p.status, p.description, p.due_date, p.paid_at, p.method,
         p.installment_number, p.installment_total
    FROM public.crm_payments p
    JOIN public.crm_leads l ON l.id = p.lead_id
   WHERE l.linked_profile_id = auth.uid()
     AND l.deleted_at IS NULL
     AND p.status IN ('paid', 'scheduled')
   ORDER BY COALESCE(p.due_date, p.paid_at);
$$;

REVOKE ALL ON FUNCTION public.get_my_crm_payments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_crm_payments() TO authenticated;
