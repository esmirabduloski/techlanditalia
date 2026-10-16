/**
 * Password dello studente, separata da quella del genitore
 * (drizzle/migrations/0046_student_passwords.sql).
 *
 * Gli studenti creati prima del cambio entravano con la password del genitore.
 * student-login continua ad accettarla per loro, senza scadenza, finché il
 * genitore (o un admin) non imposta al figlio una password propria.
 */

export const CHILD_PASSWORD_MIN_LENGTH = 8;
export const CHILD_PASSWORD_MAX_LENGTH = 72;

export interface StudentPasswordSettings {
  own_password: boolean;
}

/**
 * true se lo studente può entrare con la password del genitore: vale finché
 * non ha una password propria, senza scadenza.
 */
export function parentFallbackAllowed(settings: StudentPasswordSettings | null | undefined): boolean {
  return !settings?.own_password;
}

/** Messaggio d'errore per una password non valida, oppure null se va bene. */
export function validateChildPassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length === 0) return "Inserisci la nuova password";
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

/**
 * Password casuale che nessuno conosce, per il figlio appena creato: entra solo
 * dopo che il genitore (o un admin) gli ha impostato una password.
 */
export function randomUnknownPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  // Lettera e numero fissi in coda: soddisfano i requisiti di Supabase Auth
  return btoa(String.fromCharCode(...bytes)).replace(/[^A-Za-z0-9]/g, "") + "aA1!";
}

/** Errore di Supabase Auth per password debole o trovata in fughe di dati. */
export function isWeakPasswordError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "weak_password" || (error.message ?? "").toLowerCase().includes("weak");
}

export const WEAK_PASSWORD_MESSAGE =
  "Password troppo debole o già comparsa in fughe di dati. Scegline un'altra o premi \"Genera\".";
