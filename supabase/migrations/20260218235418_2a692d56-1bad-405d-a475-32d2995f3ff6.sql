
CREATE TABLE public.featured_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_product_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.featured_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view featured products"
ON public.featured_products FOR SELECT USING (true);

CREATE POLICY "Admins can manage featured products"
ON public.featured_products FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
