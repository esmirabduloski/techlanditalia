-- Sconti sulle rate (es. sconto fratelli) e modifica in blocco dei piani.
-- list_amount_cents = prezzo pieno prima dello sconto (NULL se nessuno sconto),
-- così lo sconto si può ricalcolare o togliere senza sommarsi a quello precedente.
ALTER TABLE public.crm_payments
  ADD COLUMN IF NOT EXISTS list_amount_cents integer CHECK (list_amount_cents IS NULL OR list_amount_cents >= 0),
  ADD COLUMN IF NOT EXISTS discount_label text;

-- Il cliente vede anche lo sconto applicato (cambia il tipo di ritorno: DROP + CREATE)
DROP FUNCTION IF EXISTS public.get_my_crm_payments();
CREATE FUNCTION public.get_my_crm_payments()
RETURNS TABLE (
  id uuid,
  amount_cents integer,
  list_amount_cents integer,
  discount_label text,
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
  SELECT p.id, p.amount_cents, p.list_amount_cents, p.discount_label, p.status, p.description,
         p.due_date, p.paid_at, p.method, p.installment_number, p.installment_total
    FROM public.crm_payments p
    JOIN public.crm_leads l ON l.id = p.lead_id
   WHERE l.linked_profile_id = auth.uid()
     AND l.deleted_at IS NULL
     AND p.status IN ('paid', 'scheduled')
   ORDER BY COALESCE(p.due_date, p.paid_at);
$$;

REVOKE ALL ON FUNCTION public.get_my_crm_payments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_crm_payments() TO authenticated;
