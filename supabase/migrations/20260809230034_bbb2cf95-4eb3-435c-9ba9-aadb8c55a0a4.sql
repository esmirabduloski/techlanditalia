CREATE TABLE public.data_deletion_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_email text NOT NULL,
  requester_name text NOT NULL,
  request_type text NOT NULL DEFAULT 'account_and_children',
  reason text,
  children jsonb NOT NULL DEFAULT '[]'::jsonb,
  confirm_understood boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_deletion_requests_type_check CHECK (request_type IN ('account_and_children','account_only','data_only')),
  CONSTRAINT data_deletion_requests_status_check CHECK (status IN ('pending','in_review','completed','rejected'))
);

CREATE INDEX idx_ddr_status_created ON public.data_deletion_requests (status, created_at DESC);
CREATE UNIQUE INDEX idx_ddr_one_open_per_user ON public.data_deletion_requests (requester_id) WHERE status IN ('pending','in_review');

GRANT SELECT, INSERT ON public.data_deletion_requests TO authenticated;
GRANT UPDATE, DELETE ON public.data_deletion_requests TO authenticated;
GRANT ALL ON public.data_deletion_requests TO service_role;

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own deletion request"
ON public.data_deletion_requests FOR INSERT TO authenticated
WITH CHECK (requester_id = auth.uid() AND status = 'pending' AND processed_by IS NULL AND processed_at IS NULL AND admin_notes IS NULL);

CREATE POLICY "Users can view their own deletion requests"
ON public.data_deletion_requests FOR SELECT TO authenticated
USING (requester_id = auth.uid());

CREATE POLICY "Admins can view all deletion requests"
ON public.data_deletion_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update deletion requests"
ON public.data_deletion_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete deletion requests"
ON public.data_deletion_requests FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_ddr_updated_at
BEFORE UPDATE ON public.data_deletion_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();