import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { csvCell } from '@/lib/csv';
import { methodLabel, todayIso } from '@/lib/payments';

export type ExportFormat = 'xlsx' | 'csv';
export type ExportStatus = 'all' | 'paid' | 'scheduled';

export interface PaymentsExportOptions {
  format: ExportFormat;
  status: ExportStatus;
  /** Periodo (YYYY-MM-DD, inclusi): incassati per data di ricezione, da incassare per scadenza */
  from?: string;
  to?: string;
  /** Solo un cliente */
  leadId?: string;
  /** Nome file senza estensione */
  fileName: string;
}

interface ExportRow {
  cliente: string;
  email: string;
  telefono: string;
  descrizione: string;
  rata: string;
  importo: number;
  prezzoPieno: number | null;
  sconto: string;
  stato: string;
  scadenza: Date | null;
  ricezione: Date | null;
  metodo: string;
  note: string;
}

const HEADERS = [
  'Cliente', 'Email', 'Telefono', 'Descrizione', 'Rata', 'Importo (€)', 'Prezzo pieno (€)', 'Sconto',
  'Stato', 'Scadenza', 'Data ricezione', 'Metodo', 'Note',
];
const COLUMN_WIDTHS = [24, 28, 16, 28, 8, 12, 14, 20, 12, 12, 14, 12, 30];

const toDate = (iso: string | null) => (iso ? parseISO(iso) : null);

async function loadRows(opts: PaymentsExportOptions): Promise<ExportRow[]> {
  let query = supabase
    .from('crm_payments')
    .select('*, crm_leads(full_name, email, phone)')
    .in('status', opts.status === 'all' ? ['paid', 'scheduled'] : [opts.status]);
  if (opts.leadId) query = query.eq('lead_id', opts.leadId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const today = todayIso();
  const inRange = (iso: string | null) =>
    !!iso && (!opts.from || iso >= opts.from) && (!opts.to || iso <= opts.to);

  return (data ?? [])
    .filter(p => (opts.from || opts.to) ? inRange(p.status === 'paid' ? p.paid_at : p.due_date) : true)
    .map(p => {
      const lead = p.crm_leads as { full_name: string | null; email: string; phone: string | null } | null;
      const overdue = p.status === 'scheduled' && !!p.due_date && p.due_date < today;
      return {
        cliente: lead?.full_name ?? '',
        email: lead?.email ?? '',
        telefono: lead?.phone ?? '',
        descrizione: p.description ?? '',
        rata: p.installment_number && p.installment_total ? `${p.installment_number}/${p.installment_total}` : '',
        importo: p.amount_cents / 100,
        prezzoPieno: p.list_amount_cents != null ? p.list_amount_cents / 100 : null,
        sconto: p.discount_label ?? '',
        stato: p.status === 'paid' ? 'Pagato' : overdue ? 'Scaduto' : 'Da pagare',
        scadenza: toDate(p.due_date),
        ricezione: toDate(p.paid_at),
        metodo: methodLabel(p.method),
        note: p.notes ?? '',
      };
    })
    .sort((a, b) =>
      ((a.ricezione ?? a.scadenza)?.getTime() ?? 0) - ((b.ricezione ?? b.scadenza)?.getTime() ?? 0));
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** CSV per Excel in italiano: separatore ";" e virgola decimale. */
function toCsv(rows: ExportRow[]): string {
  const num = (n: number | null) => (n == null ? '' : n.toFixed(2).replace('.', ','));
  const date = (d: Date | null) => (d ? format(d, 'dd/MM/yyyy') : '');
  const lines = rows.map(r => [
    r.cliente, r.email, r.telefono, r.descrizione, r.rata, num(r.importo), num(r.prezzoPieno), r.sconto,
    r.stato, date(r.scadenza), date(r.ricezione), r.metodo, r.note,
  ].map(csvCell).join(';'));
  return [HEADERS.map(csvCell).join(';'), ...lines].join('\r\n');
}

async function toXlsx(rows: ExportRow[]): Promise<Blob> {
  // Caricata solo quando serve, per non appesantire il pannello admin
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const euro = '#,##0.00 [$€-410]';
  const header = HEADERS.map(h => ({ value: h, fontWeight: 'bold' as const }));
  const body = rows.map(r => [
    { value: r.cliente }, { value: r.email }, { value: r.telefono }, { value: r.descrizione }, { value: r.rata },
    { value: r.importo, type: Number, format: euro },
    r.prezzoPieno == null ? null : { value: r.prezzoPieno, type: Number, format: euro },
    { value: r.sconto }, { value: r.stato },
    r.scadenza ? { value: r.scadenza, type: Date, format: 'dd/mm/yyyy' } : null,
    r.ricezione ? { value: r.ricezione, type: Date, format: 'dd/mm/yyyy' } : null,
    { value: r.metodo }, { value: r.note },
  ]);
  return writeXlsxFile([header, ...body], {
    sheet: 'Pagamenti',
    columns: COLUMN_WIDTHS.map(width => ({ width })),
    stickyRowsCount: 1,
  }).toBlob();
}

/** Scarica i pagamenti in Excel o CSV. Restituisce il numero di righe esportate. */
export async function exportPayments(opts: PaymentsExportOptions): Promise<number> {
  const rows = await loadRows(opts);
  if (opts.format === 'csv') {
    downloadBlob(new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8;' }), `${opts.fileName}.csv`);
  } else {
    downloadBlob(await toXlsx(rows), `${opts.fileName}.xlsx`);
  }
  return rows.length;
}
