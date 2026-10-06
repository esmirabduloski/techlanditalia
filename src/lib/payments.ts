import { addDays, addMonths, addWeeks, format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

export type PaymentStatus = 'scheduled' | 'paid' | 'cancelled';
export type ClientReminderResult = 'sent' | 'email_sent' | 'no_account' | 'no_devices' | 'no_email' | 'failed' | 'skipped_old';

/** Esito del promemoria al cliente, per i messaggi all'admin. */
export const CLIENT_RESULT_LABELS: Record<string, string> = {
  sent: 'Notifica push inviata al cliente',
  email_sent: 'Email inviata al cliente',
  no_account: 'Cliente senza account e senza email',
  no_devices: 'Il cliente non ha le notifiche attive',
  no_email: 'Il cliente non ha un indirizzo email',
  failed: 'Invio al cliente non riuscito',
  skipped_old: 'Promemoria al cliente saltato (data troppo vecchia)',
};

export interface CrmPayment {
  id: string;
  lead_id: string;
  amount_cents: number;
  status: PaymentStatus;
  description: string | null;
  due_date: string | null;
  paid_at: string | null;
  method: string | null;
  plan_id: string | null;
  installment_number: number | null;
  installment_total: number | null;
  reminder_date: string | null;
  remind_admin: boolean;
  remind_client: boolean;
  admin_reminder_sent_at: string | null;
  client_reminder_sent_at: string | null;
  client_reminder_result: ClientReminderResult | null;
  notes: string | null;
  overdue_reminder_count: number;
  last_overdue_reminder_at: string | null;
  created_at: string;
  updated_at: string;
}

export const PAYMENT_METHODS = [
  { value: 'bonifico', label: 'Bonifico' },
  { value: 'carta', label: 'Carta' },
  { value: 'contanti', label: 'Contanti' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'satispay', label: 'Satispay' },
  { value: 'stripe', label: 'Stripe (online)' },
  { value: 'altro', label: 'Altro' },
];

export const methodLabel = (value: string | null) =>
  PAYMENT_METHODS.find(m => m.value === value)?.label ?? value ?? '';

export type InstallmentFrequency = 'monthly' | 'biweekly' | 'weekly';

export const FREQUENCIES: { value: InstallmentFrequency; label: string }[] = [
  { value: 'monthly', label: 'Ogni mese' },
  { value: 'biweekly', label: 'Ogni 2 settimane' },
  { value: 'weekly', label: 'Ogni settimana' },
];

/** Giorno della notifica rispetto alla scadenza (giorni: negativo = prima). */
export const REMINDER_OFFSETS: { value: number; label: string }[] = [
  { value: -7, label: '7 giorni prima della scadenza' },
  { value: -3, label: '3 giorni prima della scadenza' },
  { value: -1, label: 'Il giorno prima della scadenza' },
  { value: 0, label: 'Il giorno della scadenza' },
  { value: 1, label: 'Il giorno dopo la scadenza' },
  { value: 3, label: '3 giorni dopo la scadenza' },
];

const euroFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
export const formatEuro = (cents: number) => euroFormatter.format(cents / 100);

/** "80", "80,50", "80.5" → 8050 centesimi; null se non valido. */
export function parseEuroToCents(input: string): number | null {
  const normalized = input.trim().replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

/** Oggi in formato YYYY-MM-DD (fuso locale). */
export const todayIso = () => format(new Date(), 'yyyy-MM-dd');

export const formatDate = (iso: string | null, pattern = 'dd/MM/yyyy') =>
  iso ? format(parseISO(iso), pattern, { locale: it }) : '—';

export const shiftDate = (iso: string, days: number) => format(addDays(parseISO(iso), days), 'yyyy-MM-dd');

export interface PlannedInstallment {
  number: number;
  dueDate: string;
  reminderDate: string;
}

/** Calcola le date delle rate a partire dalla prima scadenza. */
export function planInstallments(
  count: number,
  firstDueDate: string,
  frequency: InstallmentFrequency,
  reminderOffsetDays: number,
): PlannedInstallment[] {
  const first = parseISO(firstDueDate);
  return Array.from({ length: count }, (_, i) => {
    const due = frequency === 'monthly'
      ? addMonths(first, i)
      : addWeeks(first, frequency === 'biweekly' ? i * 2 : i);
    const dueDate = format(due, 'yyyy-MM-dd');
    return { number: i + 1, dueDate, reminderDate: shiftDate(dueDate, reminderOffsetDays) };
  });
}

/**
 * Come chiamare il pagamento in un messaggio al cliente:
 * "la rata 3/10 (Corso Python Base)", "il pagamento per Corso Scratch", "il pagamento".
 */
export function paymentPhrase(p: Pick<CrmPayment, 'installment_number' | 'installment_total' | 'description'>) {
  const desc = p.description?.trim();
  if (p.installment_number && p.installment_total) {
    return `la rata ${p.installment_number}/${p.installment_total}${desc ? ` (${desc})` : ''}`;
  }
  return desc ? `il pagamento per ${desc}` : 'il pagamento';
}

/** Etichetta di una rata, es. "Rata 2/10 · Corso Python". */
export function paymentLabel(p: Pick<CrmPayment, 'installment_number' | 'installment_total' | 'description'>) {
  const parts: string[] = [];
  if (p.installment_number && p.installment_total) parts.push(`Rata ${p.installment_number}/${p.installment_total}`);
  if (p.description) parts.push(p.description);
  return parts.join(' · ') || 'Pagamento';
}

/** Regole dei solleciti automatici (site_settings, chiave crm_payment_dunning). */
export interface DunningSettings {
  enabled: boolean;
  /** Primo sollecito: giorni dopo la scadenza */
  first_after_days: number;
  /** Solleciti successivi: ogni quanti giorni */
  repeat_every_days: number;
  /** Numero massimo di solleciti per rata */
  max_reminders: number;
  /** Manda il sollecito anche al cliente (solo per le rate con notifica al cliente attiva) */
  notify_client: boolean;
  /** Testo aggiunto alle email di promemoria al cliente, es. IBAN */
  payment_instructions?: string;
}

export const DUNNING_SETTINGS_KEY = 'crm_payment_dunning';

export const DEFAULT_DUNNING_SETTINGS: DunningSettings = {
  enabled: true,
  first_after_days: 3,
  repeat_every_days: 7,
  max_reminders: 3,
  notify_client: false,
};

/** Giorni tra due date YYYY-MM-DD (positivo se `toIso` è dopo `fromIso`). */
export const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);

/** Link WhatsApp con il messaggio di promemoria (o sollecito, se la rata è scaduta) già scritto. */
export function paymentWhatsAppLink(
  contact: { phone: string | null; full_name: string | null },
  p: Pick<CrmPayment, 'amount_cents' | 'due_date' | 'installment_number' | 'installment_total' | 'description'>,
  today = todayIso(),
): string | null {
  const phone = contact.phone?.replace(/[^\d]/g, '');
  if (!phone) return null;
  const firstName = contact.full_name?.trim().split(/\s+/)[0] ?? '';
  const hello = firstName ? `Ciao ${firstName}, ti` : 'Ciao, ti';
  const what = `${paymentPhrase(p)} di ${formatEuro(p.amount_cents)}`;
  const overdue = !!p.due_date && p.due_date < today;
  const text = overdue
    ? `${hello} scrivo da TECHLAND: risulta ancora da saldare ${what}, con scadenza il ${formatDate(p.due_date)}. Se hai già pagato, ignora pure questo messaggio. Grazie!`
    : `${hello} scrivo da TECHLAND per ricordarti ${what}${p.due_date ? ` in scadenza il ${formatDate(p.due_date)}` : ''}. Grazie!`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

/** Come arriverà il promemoria al cliente: push se ha l'app con notifiche, altrimenti email. */
export interface ClientChannel {
  /** Esiste almeno un canale (push o email) */
  canNotify: boolean;
  hint: string;
  /** L'hint è un avviso (es. notifiche non attive) */
  warn: boolean;
}

export function getClientChannel(
  hasAccount: boolean,
  hasPushDevices: boolean | null,
  email: string | null | undefined,
): ClientChannel {
  if (hasAccount && hasPushDevices !== false) {
    return {
      canNotify: true,
      hint: email ? `Notifica push sull'app (se non arriva, email a ${email})` : "Notifica push sull'app",
      warn: false,
    };
  }
  if (email) {
    return {
      canNotify: true,
      hint: hasAccount
        ? `Non ha le notifiche attive: riceverà un'email a ${email}`
        : `Non ha l'app: riceverà un'email a ${email}`,
      warn: false,
    };
  }
  return { canNotify: false, hint: "Aggiungi un'email o collega l'account per avvisare il cliente", warn: true };
}
