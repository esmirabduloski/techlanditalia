
# Piano: Navigazione Lezioni/Compiti per Insegnanti

## Contesto
Attualmente `TeacherCourseDetail.tsx` mostra solo un elenco di lezioni con possibilità di scaricare slides/manuali. L'insegnante non può entrare nelle lezioni per vedere il contenuto, le task o i compiti come fa lo studente.

## Obiettivo
Permettere all'insegnante di navigare le lezioni e i compiti **esattamente come lo studente**, con queste differenze:
- **Tutte le lezioni sbloccate** (nessun lock progressivo)
- **Nessuna logica punti/progressi** (non rilevante per l'insegnante)
- **Accesso completo** a tutti i materiali del corso assegnato

## Strategia
Riutilizzare le pagine studente esistenti (`LessonView`, `TaskView`, `HomeworkView`) aggiungendo il supporto per il ruolo insegnante, invece di creare pagine duplicate. Questo evita duplicazione di codice e mantiene la consistenza.

---

## Modifiche Necessarie

### 1. Aggiornare le Route per Insegnanti (App.tsx)
Aggiungere route dedicate per l'insegnante che puntano alle stesse view dello studente ma con un prefisso diverso:
```
/insegnante/corso/:courseId                 → Dettaglio corso (nuova versione)
/insegnante/corso/:courseId/lezione/:lessonNumber    → LessonView (adattato)
/insegnante/corso/:courseId/lezione/:lessonNumber/task/:taskNumber → TaskView (adattato)
/insegnante/corso/:courseId/compito/:homeworkId → HomeworkView (adattato)
```

### 2. Creare Hook `useTeacherCourseAccess`
Un hook che verifica se l'utente (insegnante o admin) ha accesso al corso tramite `teacher_courses`:
- Restituisce `{ hasAccess, isLoading }`
- Usato nelle view per autorizzare l'accesso

### 3. Modificare `TeacherCourseDetail.tsx`
Trasformare la pagina esistente in una vista simile a `CourseProgress.tsx` dello studente:
- Tabs "Lezioni" e "Compiti"
- Lista di lezioni **tutte sbloccate** (nessun lucchetto)
- Ogni lezione cliccabile per entrare
- Lista compiti accessibili direttamente
- Rimuovere logica punti/progressi

### 4. Modificare `LessonView.tsx`
Aggiungere supporto per accesso insegnante:
- Se l'URL inizia con `/insegnante/`, verificare accesso tramite `teacher_courses`
- Rimuovere redirect ad auth se l'utente è insegnante autenticato
- Il resto della logica rimane identico (contenuti, compiler, navigazione)

### 5. Modificare `TaskView.tsx`
Aggiungere supporto per accesso insegnante:
- Stesso approccio di LessonView
- Disabilitare la logica `completeTask` per insegnanti (non serve tracciare progressi)
- Il resto rimane identico

### 6. Modificare `HomeworkView.tsx`
Aggiungere supporto per accesso insegnante:
- Rimuovere la possibilità di "inviare" compiti (non ha senso per l'insegnante)
- Mantenere la visualizzazione completa delle istruzioni e del compiler

---

## Dettagli Tecnici

### Pattern di Rilevamento Ruolo
Nelle view condivise, usare:
```typescript
const location = useLocation();
const isTeacherView = location.pathname.startsWith('/insegnante/');
```

Questo determina:
- **isTeacherView = true**: Non mostrare badge progressi, non salvare progressi, tutte le lezioni accessibili
- **isTeacherView = false**: Comportamento studente normale

### Verifica Accesso per Insegnanti
Per le route `/insegnante/...`, verificare che:
1. L'utente sia autenticato
2. L'utente abbia ruolo `teacher` O sia `admin`
3. L'utente abbia il corso assegnato in `teacher_courses` (o sia admin)

### RLS Policies
Le RLS policies attuali già permettono a tutti di leggere `lessons`, `lesson_tasks`, `homework` con `USING (true)`. Quindi non serve modificare le policies.

---

## File da Modificare

| File | Modifica |
|------|----------|
| `src/App.tsx` | Aggiungere 3 nuove route per insegnante |
| `src/pages/teacher/TeacherCourseDetail.tsx` | Riscrivere con UI simile a CourseProgress (tabs, lista cliccabile) |
| `src/pages/area-riservata/LessonView.tsx` | Aggiungere supporto percorso insegnante |
| `src/pages/area-riservata/TaskView.tsx` | Aggiungere supporto percorso insegnante |
| `src/pages/area-riservata/HomeworkView.tsx` | Aggiungere supporto percorso insegnante + nascondere submit |
| `src/hooks/useTeacherCourseAccess.ts` | Nuovo hook per verifica accesso corso insegnante |

---

## Comportamento Finale Atteso

1. L'insegnante va su `/insegnante`
2. Clicca su un corso assegnato
3. Vede lista lezioni (tutte accessibili, nessun lucchetto)
4. Clicca su una lezione → entra nella view con contenuto/compiler
5. Naviga tra le task della lezione
6. Può vedere i compiti associati alle lezioni
7. Non vede badge punti, non salva progressi
8. Può navigare liberamente senza restrizioni

---

## Note di Sicurezza
- Le verifiche di accesso sono fatte sia lato frontend (UX) che lato backend (RLS)
- Le RLS policies su `lessons`, `lesson_tasks`, `homework` sono già `USING (true)` per SELECT
- Le tabelle di progressi (`lesson_progress`, `task_progress`, `homework_submissions`) hanno RLS che limita scrittura all'utente stesso, quindi l'insegnante non può corrompere dati studente
