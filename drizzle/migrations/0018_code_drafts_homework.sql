-- Salvataggio del codice anche nei COMPITI (homework), non solo nei task.
--
-- I compilatori salvano con la chiave "homework-<id>" nella colonna task_id,
-- che però è un uuid collegato a lesson_tasks: il database rifiutava ogni
-- salvataggio dei compiti (errore solo nella console del browser). Ora i
-- compiti hanno la loro colonna homework_id.
ALTER TABLE public.student_code_drafts
  ADD COLUMN IF NOT EXISTS homework_id uuid REFERENCES public.homework(id) ON DELETE CASCADE;

-- Esattamente uno tra lezione, task e compito
ALTER TABLE public.student_code_drafts DROP CONSTRAINT IF EXISTS code_draft_reference;
ALTER TABLE public.student_code_drafts ADD CONSTRAINT code_draft_reference CHECK (
  num_nonnulls(lesson_id, task_id, homework_id) = 1
);

-- Una bozza per studente, compito e tipo di codice (serve anche all'upsert)
ALTER TABLE public.student_code_drafts DROP CONSTRAINT IF EXISTS unique_student_homework_code;
ALTER TABLE public.student_code_drafts
  ADD CONSTRAINT unique_student_homework_code UNIQUE (student_id, homework_id, code_type);

CREATE INDEX IF NOT EXISTS idx_student_code_drafts_homework_id ON public.student_code_drafts(homework_id);
