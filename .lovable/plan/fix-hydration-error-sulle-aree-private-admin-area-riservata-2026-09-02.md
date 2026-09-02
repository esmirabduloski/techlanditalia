# Fix Hydration Error sulle aree private (/admin, /area-riservata)

## Cosa sta accadendo

Tutti gli eventi Sentry "Hydration Error" arrivano da URL **non prerenderati**:
`/admin`, `/admin/corsi/.../modifica`, `/area-riservata`.

Il sito è generato con `vite-react-ssg`: la build produce HTML statico per le pagine
pubbliche, e la home `/` finisce in `dist/index.html`. Le aree private sono escluse dal
prerender (`NO_PRERENDER_PREFIXES` in `vite.config.ts`), quindi l'hosting statico le serve
con il fallback `index.html` — che però **non è uno shell vuoto: è la home prerenderata**.

Al caricamento, il client di `vite-react-ssg` decide come montare React così:

```text
se l'HTML contiene [data-server-rendered=true]  ->  hydrateRoot()
altrimenti                                      ->  createRoot()
```

Aprendo `/admin`, l'HTML servito è quello della home (con `data-server-rendered=true`),
quindi React tenta l'**hydration** del markup della home mentre il router costruisce la
pagina admin. Il DOM non combacia -> "Hydration failed - the server rendered HTML didn't
match the client". Non è un bug delle pagine admin: è il fallback SPA che serve HTML della
route sbagliata.

Effetti collaterali oltre all'errore Sentry: primo render più lento/flash iniziale con
contenuti della home sulle pagine private.

## Soluzione

Far capire al client che, sulle route escluse dal prerender, l'HTML ricevuto non
appartiene alla route corrente: in quel caso si azzera il markup e si fa un render pulito
lato client (`createRoot`), senza hydration.

### Modifiche previste

1. **`src/main.tsx`** — prima di `ViteReactSSG({ routes })`, e solo lato client
   (`!import.meta.env.SSR`):
   - elenco condiviso dei prefissi non prerenderati (`/admin`, `/area-riservata`,
     `/insegnante`, `/auth`, `/lp`, `/.lovable`);
   - se `location.pathname` inizia con uno di questi prefissi: rimuovere l'attributo
     `data-server-rendered` dall'elemento che lo espone e svuotare `#root`.
   Risultato: la libreria imbocca il ramo `render()` invece di `hydrate()` e l'errore
   scompare, senza toccare le pagine pubbliche prerenderate (che continuano a idratare
   correttamente).

2. **Lista unica dei prefissi** — estrarre `NO_PRERENDER_PREFIXES` in un modulo condiviso
   (es. `src/lib/prerender.ts`) importato sia da `vite.config.ts` sia da `main.tsx`, per
   evitare che le due liste divergano in futuro (una divergenza riporterebbe il bug).

3. **Guardia anti-regressione in `scripts/verify-prerender.mjs`** — verificare che per ogni
   prefisso privato non esista una cartella prerenderata (controllo già presente) e
   aggiungere un check che `src/lib/prerender.ts` copra tutti i prefissi usati nel config.

### Verifica

- Build + `npm run verify:prerender`: le route pubbliche restano prerenderate con
  `data-server-rendered`, title, canonical e JSON-LD.
- Controllo in browser su `/admin`, `/area-riservata` e su una pagina task admin: nessun
  warning/errore di hydration in console; le pagine pubbliche (`/`, `/corsi`, `/blog`)
  continuano a idratare senza errori.
- Dopo il deploy, gli eventi "Hydration Error" su Sentry devono cessare.

## Note

- Nessuna modifica a logica di business, RLS o edge function.
- Se in futuro si volesse un vero shell SPA separato per il fallback (invece della home
  prerenderata), quella è un'ottimizzazione lato hosting che richiede un fallback
  configurabile; la soluzione qui proposta funziona indipendentemente dall'hosting.
