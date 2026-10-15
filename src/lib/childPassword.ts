/**
 * Password dello studente impostata dal genitore (area riservata).
 * Stesse regole di validateChildPassword in
 * supabase/functions/_shared/studentpassword.ts: il controllo vero è lì.
 */

export const CHILD_PASSWORD_MIN_LENGTH = 8;
export const CHILD_PASSWORD_MAX_LENGTH = 72;

/** Messaggio d'errore per una password non valida, oppure null se va bene. */
export function validateChildPassword(password: string): string | null {
  if (password.length === 0) return "Inserisci la nuova password";
  if (password.trim() !== password) return "La password non può iniziare o finire con uno spazio";
  if (password.length < CHILD_PASSWORD_MIN_LENGTH) {
    return `La password deve avere almeno ${CHILD_PASSWORD_MIN_LENGTH} caratteri`;
  }
  if (password.length > CHILD_PASSWORD_MAX_LENGTH) {
    return `La password può avere al massimo ${CHILD_PASSWORD_MAX_LENGTH} caratteri`;
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "La password deve contenere almeno una lettera e un numero";
  }
  return null;
}

const ANIMALS = [
  "Gatto", "Cane", "Volpe", "Lupo", "Orso", "Tigre", "Leone", "Gufo", "Falco", "Delfino",
  "Panda", "Koala", "Riccio", "Castoro", "Pinguino", "Zebra", "Giraffa", "Coniglio", "Drago", "Robot",
];
const COLORS = [
  "Blu", "Rosso", "Verde", "Giallo", "Viola", "Arancio", "Rosa", "Nero", "Bianco", "Oro",
  "Argento", "Azzurro", "Celeste", "Lilla", "Bronzo",
];

function randomInt(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

/** Password facile da leggere e scrivere per un bambino, es. "Volpe-Blu-4827". */
export function generateChildPassword(): string {
  const number = String(1000 + randomInt(9000));
  return `${ANIMALS[randomInt(ANIMALS.length)]}-${COLORS[randomInt(COLORS.length)]}-${number}`;
}
