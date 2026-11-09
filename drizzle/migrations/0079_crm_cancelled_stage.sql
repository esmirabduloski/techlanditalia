-- CRM: nuova fase della pipeline "Disdetto" per le famiglie clienti che hanno
-- disdetto l'abbonamento, separate dai lead "Persi" (mai diventati clienti).
--
-- La finestra "Registra disdetta" del CRM ora sposta il lead qui invece che in
-- "Perso". I lead già in "Perso" restano dove sono.

ALTER TYPE public.crm_pipeline_stage ADD VALUE IF NOT EXISTS 'cancelled' AFTER 'won';
