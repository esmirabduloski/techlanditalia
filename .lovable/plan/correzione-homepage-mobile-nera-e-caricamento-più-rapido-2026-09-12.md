# Correzione homepage mobile nera e caricamento più rapido

## Obiettivo
Rendere immediatamente visibili testo e pulsanti della homepage sugli smartphone, anche con rete lenta o JavaScript ritardato, e ridurre il lavoro iniziale del browser.

## Interventi
1. Rimuovere l'animazione iniziale che nasconde tutto il contenuto principale per 1,2 secondi: titolo, testo e pulsanti saranno presenti e visibili già nel primo caricamento.
2. Conservare il video interattivo solo su desktop; su smartphone non verrà scaricato né inizializzato.
3. Alleggerire il primo caricamento rimandando le parti non essenziali sotto la prima schermata, senza modificare contenuti o navigazione.
4. Verificare la homepage a 390 px, in tema chiaro e scuro, controllando visibilità, assenza di schermate nere ed errori.

## Risultato atteso
La homepage mostra subito l'offerta TECHLAND sotto il menu su smartphone, mentre il resto della pagina completa il caricamento progressivamente.
