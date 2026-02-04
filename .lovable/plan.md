
## Obiettivo
Far sì che un genitore possa:
1) fare login sempre (senza loop ricorsivi)  
2) vedere **Calendario Lezioni**, **Storico Presenze**, **Storico Compiti** del figlio (senza errori 500 “infinite recursion” mascherati come “nessun dato”).

---

## Diagnosi (cosa non va oggi, con prova)
Le 3 sezioni non si popolano perché le loro chiamate al backend falliscono con **500**.

Dai log di rete della tua sessione:
- richiesta a `group_students` → **500**
- messaggio: `infinite recursion detected in policy for relation "student_groups"` e anche per `"group_students"`

Quindi non è “mancanza di dati”: i dati esistono (nel DB ci sono:
- il figlio collegato al genitore
- una membership in `group_students`
- righe in `group_lesson_schedule`
- righe in `group_attendance`
- almeno una riga in `homework_submissions`).

È proprio un **blocco RLS** (Row Level Security) che genera loop.

---

## Perché si rompe “una volta il login, una volta le sezioni”
Il problema è un “ciclo” tra policy RLS:

- alcune policy su **group_students** fanno `EXISTS (SELECT ... FROM student_groups ...)`
- alcune policy su **student_groups** fanno `EXISTS (SELECT ... FROM group_students ...)`

Postgres applica le policy riscrivendo la query; anche se l’utente è “genitore” e “teoricamente” la policy teacher non dovrebbe contare, il motore deve comunque comporre/esaminare i predicati e finisce nel loop.

Risultato:
- a volte il login sembra ok (perché tocca tabelle diverse)
- appena la dashboard prova a leggere `group_students` / embed di `student_groups`, esplode in recursion → 500 → UI mostra “nessun dato”.

---

## Strategia di correzione (robusta, senza “tira e molla”)
Spezzare il ciclo eliminando **qualsiasi policy che interroga direttamente l’altra tabella “speculare”**.

Soluzione standard e stabile:
- introdurre **funzioni `SECURITY DEFINER`** (helper) per i controlli di appartenenza
- riscrivere le policy usando quelle funzioni, così:
  - le policy non contengono più sottoquery incrociate
  - i controlli restano sicuri (non apriamo accessi “public”)
  - spariscono i loop ricorsivi

---

## Modifiche backend (Lovable Cloud) – dettagli
### 1) Nuove funzioni helper (security definer)
Creerò 3 funzioni:

- `is_teacher_of_group(teacher_id, group_id)`  
  Verifica se il teacher è assegnato al gruppo.

- `is_student_in_group(student_id, group_id)`  
  Verifica se lo studente è nel gruppo (tabella `group_students`).

- `is_parent_of_group(parent_id, group_id)`  
  Verifica se esiste un `group_students` per un figlio con `profiles.parent_id = parent_id`.

Tutte con:
- `SECURITY DEFINER`
- `STABLE`
- `SET search_path = public`

### 2) Riscrittura policy che oggi generano il loop
Aggiornerò queste policy:

**A) `group_students`**
- sostituire le policy “Teachers can view …” (che oggi leggono `student_groups`) con:
  - `USING (public.is_teacher_of_group(auth.uid(), group_id))`

**B) `student_groups`**
- sostituire policy genitori e studenti (che oggi leggono `group_students`) con:
  - genitori: `USING (public.is_parent_of_group(auth.uid(), id))`
  - studenti: `USING (public.is_student_in_group(auth.uid(), id))`

**C) `group_lesson_schedule` (consigliato per coerenza e per evitare embed rognosi)**
- genitori: `USING (public.is_parent_of_group(auth.uid(), group_id))`
- studenti: `USING (public.is_student_in_group(auth.uid(), group_id))`
- insegnanti: `USING (public.is_teacher_of_group(auth.uid(), group_id))` (SELECT e UPDATE)

**D) `group_attendance` (teacher ALL)**
- teacher ALL: `USING (public.is_teacher_of_group(auth.uid(), group_id))`

Questo rende tutte le query delle 3 sezioni “lineari” e senza ricorsione.

---

## Modifiche frontend (per evitare “silenzio totale” e bug di mapping)
### 1) Non nascondere gli errori
Nei componenti:
- `ChildLessonCalendar`
- `ChildAttendanceHistory`
- `ChildHomeworkHistory`

aggiungerò gestione esplicita di `error` da Supabase client:
- se arriva un error (es. 500 recursion), mostrare un box “Errore di caricamento” + pulsante “Riprova”
- log dettagliato in console con `error.message` e query coinvolta

Così se in futuro una policy si rompe, non sembrerà “non ci sono lezioni”.

### 2) Presenze: bug di status (“justified” vs “excused”)
Nel DB e nella dashboard insegnante lo status è:
- `present`
- `absent`
- `justified`

In `ChildAttendanceHistory` invece controlli:
- `present`
- `absent`
- `excused`

Quindi anche quando la query funzionerà, “justified” oggi finirebbe trattato male.

Correzione:
- accettare `justified` come “giustificato” (e aggiornare type union e rendering).

---

## Piano di test end-to-end (dopo la fix)
1) Login come genitore `esmirtutto@gmail.com`
2) Vai su `/area-riservata`
3) Apri tab figlio “Figlio”
4) Verifica:
   - **Calendario Lezioni**: mostra le lezioni (non “Nessuna lezione programmata”)
   - **Storico Presenze**: mostra celle colorate e “Giustificato” per status `justified`
   - **Storico Compiti**: mostra stato consegna/grade se presente
5) Controllo tecnico:
   - nessuna richiesta a `group_students` / `student_groups` deve più tornare 500
6) Smoke test insegnante:
   - pagina gruppo insegnante (mark presenze) ancora funzionante

---

## Deliverable (cosa cambierò in pratica)
- 1 migrazione DB:
  - create/replace funzioni helper
  - drop & recreate policy su: `group_students`, `student_groups`, `group_lesson_schedule`, `group_attendance` (solo quelle coinvolte)
- 3 file TSX:
  - fix mapping status presenze (`justified`)
  - error UI + retry nelle 3 sezioni

---

## Note importanti (sicurezza)
- Nessuna tabella diventa pubblica
- I genitori vedono solo gruppi/lezioni/presenze/compiti collegati ai propri figli
- Le funzioni security definer fanno solo “check booleani” di membership, non espongono dati sensibili

