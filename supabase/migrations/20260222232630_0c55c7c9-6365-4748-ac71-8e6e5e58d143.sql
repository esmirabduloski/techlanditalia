
-- Table for content snapshots
CREATE TABLE public.content_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, -- 'course', 'lesson', 'lesson_task', 'homework'
  entity_id uuid NOT NULL,
  entity_label text NOT NULL, -- human-readable label (e.g. course title)
  snapshot_label text, -- optional user label
  snapshot_data jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage snapshots"
ON public.content_snapshots
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_snapshots_entity ON public.content_snapshots (entity_type, entity_id);
CREATE INDEX idx_snapshots_created ON public.content_snapshots (created_at DESC);
