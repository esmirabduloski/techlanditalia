import { addDays, addMonths, addWeeks, format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

export type PaymentStatus = 'scheduled' | 'paid' | 'cancelled';
export type ClientReminderResult = 'sent' | 'no_account' | 'no_devices' | 'failed' | 'skipped_old';

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

/** Etichetta di una rata, es. "Rata 2/10 · Corso Python". */
export function paymentLabel(p: Pick<CrmPayment, 'installment_number' | 'installment_total' | 'description'>) {
  const parts: string[] = [];
  if (p.installment_number && p.installment_total) parts.push(`Rata ${p.installment_number}/${p.installment_total}`);
  if (p.description) parts.push(p.description);
  return parts.join(' · ') || 'Pagamento';
}
