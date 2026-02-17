

# Piano: Pagina Acquisto Corsi con Stripe

## Panoramica

Creare una pagina elegante nell'area riservata del genitore dove poter acquistare corsi/servizi. I prodotti e prezzi verranno caricati direttamente da Stripe, cosi potrai gestirli dal tuo pannello Stripe senza toccare il codice.

## Come funziona

1. Tu crei i tuoi prodotti e prezzi nel pannello Stripe (stripe.com/dashboard)
2. Una backend function li recupera da Stripe e li mostra nella pagina
3. Quando il genitore clicca "Acquista", viene creata una sessione di checkout Stripe e il genitore viene reindirizzato alla pagina di pagamento sicura di Stripe
4. Dopo il pagamento, il genitore torna alla pagina con conferma

## Come cambiare la chiave API pubblica

La chiave pubblica di test (`pk_test_...`) verra salvata nel codice in un file dedicato. Quando vorrai passare alla chiave di produzione:
- Apri il file `src/lib/stripe.ts`
- Sostituisci la stringa `pk_test_...` con la tua chiave `pk_live_...`

## Cosa verra creato

### 1. File di configurazione Stripe (`src/lib/stripe.ts`)
- Contiene la chiave pubblica di Stripe
- Punto unico dove cambiarla in futuro

### 2. Edge Function: `stripe-get-products`
- Recupera i prodotti attivi e i relativi prezzi dal tuo account Stripe
- Richiede la chiave segreta di Stripe (ti verra chiesta)

### 3. Edge Function: `stripe-create-checkout`
- Crea una sessione di pagamento Stripe Checkout
- Accetta il `price_id` del prodotto scelto
- Reindirizza il genitore alla pagina di pagamento

### 4. Pagina Acquisti (`src/pages/area-riservata/Acquisti.tsx`)
- Design elegante con card per ogni prodotto/servizio
- Mostra nome, descrizione, prezzo dal catalogo Stripe
- Bottone "Acquista" per ogni prodotto
- Gestione stati di caricamento e errori
- Messaggio di successo dopo il pagamento

### 5. Rotta e navigazione
- Nuova rotta `/area-riservata/acquisti`
- Link nella Dashboard del genitore per accedere alla pagina

## Dettagli tecnici

### Flusso di acquisto

```text
+------------------+     +---------------------+     +------------------+
| Pagina Acquisti  | --> | stripe-create-      | --> | Stripe Checkout  |
| (lista prodotti) |     | checkout (backend)  |     | (pagamento)      |
+------------------+     +---------------------+     +------------------+
                                                            |
                                                            v
                                                     +------------------+
                                                     | Ritorno alla     |
                                                     | pagina con esito |
                                                     +------------------+
```

### Chiave segreta Stripe
Ti verra chiesto di inserire la chiave segreta (`sk_test_...`) che serve lato backend per comunicare con Stripe. La trovi nel tuo pannello Stripe sotto Developers > API Keys.

### Edge Functions

**`stripe-get-products`**: GET request, nessuna autenticazione richiesta, chiama l'API Stripe per listare prodotti e prezzi attivi.

**`stripe-create-checkout`**: POST request, riceve `{ priceId }`, crea una Checkout Session e ritorna l'URL di pagamento.

### File modificati
- `src/App.tsx` - aggiunta rotta `/area-riservata/acquisti`
- `src/pages/area-riservata/Dashboard.tsx` - link alla pagina acquisti
- `supabase/config.toml` - configurazione nuove edge functions

### File creati
- `src/lib/stripe.ts` - chiave pubblica Stripe
- `src/pages/area-riservata/Acquisti.tsx` - pagina acquisti
- `supabase/functions/stripe-get-products/index.ts` - recupero prodotti
- `supabase/functions/stripe-create-checkout/index.ts` - creazione checkout

