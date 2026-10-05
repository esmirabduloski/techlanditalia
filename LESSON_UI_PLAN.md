# Piano UI Lezioni & Task

Obiettivo: lezioni e task più belle, più chiare e più facili da navigare (soprattutto per i ragazzi).
File coinvolti: `src/pages/area-riservata/TaskView.tsx`, `src/pages/area-riservata/LessonView.tsx`,
`src/components/lesson/TaskNavigation.tsx`, `src/components/lesson/LessonNavigation.tsx`, `src/components/lesson/LessonContent.tsx`.

---

## 🔴 P0 — Bug / problemi che confondono subito

- [x] **Numero task incoerente.** L'header mostra `Task {task.task_number}` (numero nel DB), la navigazione in basso mostra la posizione tra i task visibili (`displayPosition`). Se un task è nascosto si legge "Task 4" in alto e "Task 3 di 5" in basso. → Usare ovunque `displayPosition`.
- [x] **Scroll non torna in cima** passando al task successivo nel layout diviso: il pannello sinistro resta scrollato in fondo. → Reset dello scroll del pannello (ref + `scrollTo(0,0)`) quando cambia `taskNumber`.
- [x] **Contenuto vecchio durante il caricamento**: `isLoading` non torna a `true` cambiando task, quindi per un attimo si vede il task precedente. → Reset dello stato all'inizio di `fetchData`.
- [x] **Navigazione nascosta in fondo**: i pulsanti avanti/indietro sono solo alla fine del testo; su lezioni lunghe bisogna scrollare tutto. → Barra di navigazione fissa (vedi P1).

## 🟠 P1 — Orientamento: "dove sono?" e "come vado avanti?"

- [x] **Header unico `LessonHeader`** riusato nei 3 layout (oggi il codice è duplicato 3 volte e il layout normale non ha header):
  - breadcrumb: `Corso › Lezione 3 › Task 2`
  - **badge grande col numero lezione** (es. cerchio colorato "L3") + titolo lezione
  - titolo del task ben visibile
  - ~~pulsanti ← → compatti a destra~~ → sostituiti dallo stepper cliccabile + barra sticky in basso
- [x] **Stepper dei task** sotto l'header: pallini/segmenti numerati `① ② ③ ④ ⑤`, quello corrente evidenziato, quelli completati con ✓, cliccabili per saltare a un task.
- [x] **Barra di progresso** della lezione (es. "2 di 5 completati" + barra) nell'header.
- [x] **Navigazione sticky in basso** (footer fisso del pannello) con: `← Precedente` | `Task 2 di 5` | `Successivo →`. Pulsante "Successivo" più grande e colorato (azione principale).
- [x] **Fine lezione → lezione successiva**: oggi l'ultimo task porta al corso. Mostrare una schermata "Lezione completata 🎉" con "Vai alla lezione 4 →" e "Torna al corso".
- [x] **Indice / sommario laterale** (Sheet/Drawer apribile da un'icona ☰): elenco lezioni del corso con task e stato (✓ fatto, ● in corso, 🔒 non disponibile).

## 🟡 P2 — Più carine e motivanti

> Nota: le lezioni usano ora la classe `.lesson-prose` (in `index.css`). Il plugin `@tailwindcss/typography` è installato ma non attivo, quindi le classi `prose` altrove (blog, privacy…) non hanno effetto.

- [x] **Feedback quando si completa un task**: toast o piccola animazione "+{points_reward} punti" (il campo `points_reward` esiste ma non viene mostrato).
- [x] Badge "Task completato" spostato nell'header/stepper invece che in fondo, dove nessuno lo vede.
- [x] **Colore per corso** (Python, Web, Scratch…) usato in header, stepper e pulsanti, così ogni corso ha la sua identità.
- [x] **Icona per tipo di task**: 📖 teoria, 💻 codice, ❓ quiz, 🐱 Scratch — nello stepper e nell'header.
- [x] **Stile del contenuto**: box "💡 Suggerimento" / "⚠️ Attenzione" / "🎯 Obiettivo", blocchi di codice con pulsante "Copia", immagini con didascalia e zoom al click.
- [x] **Skeleton** al posto dello spinner a tutto schermo durante il caricamento.
- [ ] Rinominare "Task" in "Esercizio" / "Missione" (più chiaro per i ragazzi) — da decidere.

## 🟢 P3 — Funzionalità e rifinitura

- [x] **Mobile**: il layout diviso orizzontale (testo | compilatore) è inutilizzabile sul telefono → sotto `md` usare tab `📖 Spiegazione` / `💻 Codice`.
- [x] **Scorciatoie da tastiera**: `←` / `→` per task precedente/successivo (disattivate quando il focus è nell'editor).
- [x] **Pannello ridimensionabile**: ricordare la larghezza scelta (`autoSaveId` di `ResizablePanelGroup`).
- [x] Pulsante "Ricomincia codice" ben visibile nel compilatore. — già presente nei compilatori (icona ↺ "Resetta codice"), non modificato
- [x] Accessibilità: `aria-current="step"` nello stepper, focus visibile sui pulsanti, annuncio del cambio task.
- [x] Allineare anche le viste insegnante (`TeacherLessonView`, `TeacherTaskView`) agli stessi componenti.

---

### Ordine consigliato di lavoro
1. Fix P0 (piccoli, ~1h).
2. Componente `LessonHeader` + stepper + nav sticky (risolve la maggior parte dei problemi di orientamento).
3. Schermata fine lezione + feedback punti.
4. Mobile a tab.
5. Il resto di P2/P3.
