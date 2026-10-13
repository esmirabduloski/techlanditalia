/**
 * Testo della push agli admin quando il saldo lezioni di uno studente scende
 * a 3 (trigger lesson_balance_low_alert, drizzle/migrations/0029_lesson_balance_alert.sql).
 */

export function lowBalanceMessage(opts: {
  studentName: string;
  balance: number;
  parentName?: string | null;
  groupTitle?: string | null;
}): { title: string; body: string } {
  const { studentName, balance, parentName, groupTitle } = opts;
  const title = balance <= 0
    ? `📉 ${studentName} ha finito le lezioni`
    : `📉 ${studentName}: ${balance === 1 ? "resta 1 lezione" : `restano ${balance} lezioni`}`;
  const details = [
    groupTitle,
    parentName ? `genitore ${parentName}` : null,
  ].filter(Boolean).join(" · ");
  const body = (balance <= 0 ? "Pacchetto esaurito" : "Pacchetto quasi finito") +
    (details ? ` (${details})` : "") + ". Proponi il rinnovo alla famiglia.";
  return { title, body };
}
