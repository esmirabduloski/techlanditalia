

# Fix: Bottone Dashboard che sparisce per gli insegnanti

## Problema

Nella Navbar, la logica condizionale per mostrare il bottone "Dashboard" esclude completamente gli insegnanti. Quando un insegnante e' loggato e naviga alla homepage (cliccando il logo TECHLAND), non vede ne' "Accedi" ne' "Dashboard" -- resta bloccato senza modo di tornare alla propria area.

### Codice problematico (riga 71 e 123)

```text
!user ?  "Accedi"
: !isInAreaRiservata && !isTeacher ?  "Dashboard → /area-riservata"
: null   ← insegnante finisce qui: NESSUN BOTTONE
```

## Soluzione

Rivedere la logica condizionale per gestire correttamente tutti i ruoli:

```text
!user ?  "Accedi"
: isTeacher && !isInTeacherArea ?  "Dashboard → /insegnante"
: !isTeacher && !isInAreaRiservata ?  "Dashboard → /area-riservata"
: null  (gia' nella propria area, nascondere)
```

## Modifiche

### File: `src/components/layout/Navbar.tsx`

1. **Aggiungere variabile per area insegnante**: Controllare se il path inizia con `/insegnante` oltre che `/area-riservata`

```typescript
const isInAreaRiservata = location.pathname.startsWith('/area-riservata');
const isInTeacherArea = location.pathname.startsWith('/insegnante');
```

2. **Rivedere la logica del bottone Desktop** (righe 67-78): Tre casi distinti:
   - Utente non loggato: mostra "Accedi"
   - Insegnante loggato, non nella propria area: mostra "Dashboard" che punta a `/insegnante`
   - Studente/genitore loggato, non nella propria area: mostra "Dashboard" che punta a `/area-riservata`
   - Utente gia' nella propria area: nessun bottone (per evitare link circolare)

3. **Rivedere la stessa logica nel menu Mobile** (righe 119-130): Applicare lo stesso identico pattern di tre casi

### Risultato atteso

| Stato | Bottone mostrato | Link |
|-------|-----------------|------|
| Non loggato | "Accedi" | /auth |
| Insegnante su homepage | "Dashboard" | /insegnante |
| Insegnante su /insegnante | Nessuno | - |
| Studente su homepage | "Dashboard" | /area-riservata |
| Studente su /area-riservata | Nessuno | - |

### Dettagli tecnici

La modifica coinvolge un solo file (`Navbar.tsx`) e consiste nel:
- Aggiungere una variabile `isInTeacherArea`
- Sostituire la condizione `!isInAreaRiservata && !isTeacher` con una logica a tre rami che gestisce correttamente sia insegnanti che studenti
- Applicare la stessa modifica sia nella sezione desktop che mobile del componente

