-- Analytics: la INSERT su page_views dal sito pubblico fallisce a OGNI caricamento
-- pagina con 400 (SQLSTATE 42703 "column created_at does not exist"), quindi il
-- tracking delle visite non registra nulla da tempo.
--
-- La tabella ha solo entered_at; nel database live c'è un trigger (non presente in
-- queste migration) che referenzia created_at. Aggiungiamo la colonna con default
-- now(): il trigger torna a funzionare e l'app continua a usare entered_at.
ALTER TABLE public.page_views
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
