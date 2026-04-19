
## Problema
PageSpeed/GSC segnala errore 401 in console su `POST /rest/v1/page_views`. Causa: la RLS policy di INSERT su `page_views` richiede utenti autenticati, ma `AnalyticsProvider` traccia ogni page view anche per visitatori anonimi (homepage pubblica) → ogni visita anonima genera un 401 visibile in console e penalizza il punteggio "Best Practices".

## Soluzione
Permettere insert anonimi su `page_views` (è una tabella di sola scrittura per analytics, già pensata per tracking pubblico — vedi memoria `analytics-page-views-policy`).

### Step 1 — Migrazione DB
Aggiungere policy RLS che permetta INSERT anche al ruolo `anon`:
```sql
CREATE POLICY "Anyone can insert page views"
ON public.page_views
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
```
(Mantengo le policy SELECT esistenti restrittive: solo admin può leggere.)

Stesso fix per `analytics_events` (tracciato anch'esso da utenti anonimi in `AnalyticsProvider`):
```sql
CREATE POLICY "Anyone can insert analytics events"
ON public.analytics_events
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
```

### Step 2 — Hardening client
In `AnalyticsProvider.tsx`, rendere il tracking silenzioso (no `console.error`) per evitare rumore in console anche in caso di futuri fallimenti:
- Sostituire `console.error(...)` con un no-op o `console.debug` nei catch.

## Risultato atteso
- Niente più 401 in console su `/page_views`
- Punteggio "Best Practices" di PageSpeed sale (era penalizzato dagli errori console)
- Analytics continua a funzionare regolarmente per tutti i visitatori
