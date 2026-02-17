

# Aggiornamento chiave segreta Stripe

## Problema
Il secret `STRIPE_SECRET_KEY` attualmente contiene una chiave non valida. L'errore da Stripe dice: "This API call cannot be made with a publishable API key".

Anche le chiavi `rk_test_` (restricted keys) non funzionano per le chiamate che facciamo (listare prodotti e creare checkout sessions) perche hanno permessi limitati.

## Soluzione
Aggiornare il secret `STRIPE_SECRET_KEY` con la chiave segreta completa che inizia con `sk_test_`.

### Dove trovarla
1. Vai su stripe.com/dashboard
2. Clicca su "Developers" in alto a destra
3. Poi "API Keys"
4. Copia la "Secret key" -- quella che inizia con `sk_test_`
5. Se non la vedi, clicca su "Reveal test key" per mostrarla

### Cosa faro
- Aggiornare il valore del secret `STRIPE_SECRET_KEY` con la chiave corretta
- Nessuna modifica al codice necessaria, le edge functions sono gia configurate correttamente

