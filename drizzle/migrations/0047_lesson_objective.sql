-- Obiettivo della lezione: una frase mostrata ai ragazzi all'inizio della
-- lezione ("Oggi imparerai a …") e ai genitori nel calendario del figlio.
-- Si salva solo il completamento, senza il prefisso "Oggi imparerai a".
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS objective text;