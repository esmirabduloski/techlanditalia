
## Problema
Google Search Console segnala "Tipo di oggetto non valido per campo `hiringOrganization`" sullo schema JobPosting della pagina `/lavora-con-noi`. Causa probabile: `hiringOrganization` è definito come stringa o gli manca il `@type: "Organization"` richiesto da schema.org.

## Indagine
Leggo `src/pages/LavoraConNoi.tsx` per vedere come è generato lo schema JSON-LD dei 4 JobPosting (Python, Roblox, Scratch, Unity) e correggere il campo.

## Fix previsto
Per ogni JobPosting, `hiringOrganization` deve essere un oggetto valido:
```json
"hiringOrganization": {
  "@type": "Organization",
  "name": "TECHLAND",
  "sameAs": "https://techlanditalia.it",
  "logo": "https://techlanditalia.it/logo.png"
}
```

Verifico anche che siano presenti gli altri campi obbligatori/raccomandati di JobPosting per evitare warning correlati:
- `title`, `description`, `datePosted`, `validThrough`
- `jobLocation` oppure `jobLocationType: "TELECOMMUTE"` + `applicantLocationRequirements` (per lavoro remoto in Italia)
- `employmentType`
- `identifier` con `@type: "PropertyValue"`

## Step
1. Leggere `src/pages/LavoraConNoi.tsx` per ispezionare lo schema attuale.
2. Sostituire `hiringOrganization` con l'oggetto `Organization` completo nei 4 JobPosting.
3. Aggiungere/correggere campi mancanti (jobLocationType, applicantLocationRequirements, identifier) se assenti.
4. Validare mentalmente con la struttura richiesta dal Rich Results Test di Google.

## Risultato atteso
- Zero warning "Tipo di oggetto non valido" su Search Console dopo re-indicizzazione.
- I 4 annunci diventano idonei ai risultati avanzati Google for Jobs.
