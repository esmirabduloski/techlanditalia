/**
 * Report mensile per gli admin (drizzle/migrations/0037_monthly_report.sql).
 *
 * I numeri arrivano da public.monthly_report_stats(); qui si sceglie il mese,
 * si confronta con quello prima e si compone la mail (HTML e testo).
 */

export type SurveyStats = {
  sent: number;
  answered: number;
  promoters: number;
  detractors: number;
  avg_score: number | null;
};

export type MonthlyStats = {
  from: string;
  to: string;
  enrollments: { families_won: number; new_students: number };
  cancellations: {
    total: number;
    whole_family: number;
    by_reason: { reason: string; count: number }[];
    would_return: { yes: number; maybe: number; no: number };
  };
  revenue: { paid_cents: number; paid_count: number; unpaid_cents: number; unpaid_count: number };
  trials: { requested: number; completed: number; cancelled: number; converted: number };
  conversion: { won: number; lost: number };
  satisfaction: {
    /** Sondaggio di gradimento (0034); null se la tabella non c'è */
    surveys: SurveyStats | null;
    attendance_marked: number;
    attendance_present: number;
    attendance_justified: number;
    at_risk_flagged: number;
  };
  active_students: number;
};

/** Stesse etichette di src/lib/subscriptionCancellation.ts */
export const CANCELLATION_REASON_LABELS: Record<string, string> = {
  cost: "Costo",
  schedule: "Orari / giorni delle lezioni",
  lost_interest: "Il figlio non è più interessato",
  little_progress: "Pochi progressi",
  too_busy: "Troppi impegni (scuola, sport)",
  moving: "Trasloco",
  teacher_group: "Insegnante o gruppo",
  other: "Altro",
};

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonth(s: unknown): s is string {
  return typeof s === "string" && MONTH_RE.test(s);
}

/** Primo giorno del mese e primo giorno del mese dopo (YYYY-MM-DD). */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { from: `${month}-01`, to: `${next}-01` };
}

export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Mese appena chiuso in Italia: il 1° ottobre il report è quello di settembre. */
export function reportMonth(now: Date = new Date()): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(now);
  return previousMonth(today.slice(0, 7));
}

/** "settembre 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, 1)));
}

const monthName = (month: string) => monthLabel(month).split(" ")[0];

/** "rispetto ad agosto", "rispetto a settembre" */
const vsMonth = (month: string) => {
  const name = monthName(month);
  return `rispetto ${/^[aeiou]/.test(name) ? "ad" : "a"} ${name}`;
};

export function euro(cents: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", useGrouping: "always" }).format(cents / 100);
}

/** Percentuale intera, null se il denominatore è 0. */
export function pct(n: number, d: number): number | null {
  return d > 0 ? Math.round((n / d) * 100) : null;
}

export function conversionRate(s: MonthlyStats): number | null {
  return pct(s.conversion.won, s.conversion.won + s.conversion.lost);
}

/** Net Promoter Score (-100…100): % promotori (9-10) meno % detrattori (0-6). */
export function nps(s: MonthlyStats): number | null {
  const v = s.satisfaction.surveys;
  if (!v || v.answered === 0) return null;
  return Math.round(((v.promoters - v.detractors) / v.answered) * 100);
}

/** Presenti su presenze segnate. */
export function attendanceRate(s: MonthlyStats): number | null {
  return pct(s.satisfaction.attendance_present, s.satisfaction.attendance_marked);
}

type Tone = "good" | "bad" | "neutral";
export type Delta = { text: string; tone: Tone };

/**
 * Variazione rispetto al mese prima. higherIsBetter decide il colore
 * (più disdette è male); format scrive la differenza.
 */
export function delta(
  cur: number | null,
  prev: number | null,
  opts: { higherIsBetter?: boolean; format?: (n: number) => string } = {},
): Delta | null {
  if (cur === null || prev === null) return null;
  const diff = cur - prev;
  if (diff === 0) return { text: "=", tone: "neutral" };
  const fmt = opts.format ?? String;
  const better = opts.higherIsBetter ?? true;
  return {
    text: `${diff > 0 ? "+" : "−"}${fmt(Math.abs(diff))}`,
    tone: (diff > 0) === better ? "good" : "bad",
  };
}

/** Le due o tre cose da notare subito, in cima alla mail. */
export function highlights(month: string, cur: MonthlyStats, prev: MonthlyStats): string[] {
  const out: string[] = [];
  const vs = vsMonth(previousMonth(month));

  const paid = cur.revenue.paid_cents;
  const prevPaid = prev.revenue.paid_cents;
  if (prevPaid > 0) {
    const change = Math.round(((paid - prevPaid) / prevPaid) * 100);
    if (change >= 15) out.push(`Incassi in crescita del ${change}% ${vs}.`);
    if (change <= -15) out.push(`Incassi in calo del ${-change}% ${vs}.`);
  }

  if (cur.revenue.unpaid_count > 0) {
    out.push(
      cur.revenue.unpaid_count === 1
        ? `1 rata con scadenza a ${monthName(month)} è ancora da incassare (${euro(cur.revenue.unpaid_cents)}).`
        : `${cur.revenue.unpaid_count} rate con scadenza a ${monthName(month)} sono ancora da incassare (${euro(cur.revenue.unpaid_cents)}).`,
    );
  }

  const joined = cur.enrollments.families_won;
  const left = cur.cancellations.total;
  if (left > joined) {
    out.push(`Più disdette (${left}) che nuove famiglie iscritte (${joined}).`);
  }

  const top = cur.cancellations.by_reason[0];
  if (top && top.count >= 2) {
    out.push(`Motivo di disdetta più frequente: ${CANCELLATION_REASON_LABELS[top.reason] ?? top.reason} (${top.count}).`);
  }

  const curNps = nps(cur);
  const prevNps = nps(prev);
  if (curNps !== null && prevNps !== null && curNps - prevNps <= -15) {
    out.push(`NPS sceso da ${prevNps} a ${curNps}: guarda i commenti dei voti bassi nel CRM.`);
  }
  if (cur.satisfaction.surveys && cur.satisfaction.surveys.detractors > 0) {
    const d = cur.satisfaction.surveys.detractors;
    out.push(d === 1
      ? "1 famiglia ha dato un voto da 0 a 6 nel sondaggio di gradimento."
      : `${d} famiglie hanno dato un voto da 0 a 6 nel sondaggio di gradimento.`);
  }

  if (cur.trials.requested === 0) {
    out.push("Nessuna richiesta di lezione di prova nel mese.");
  }
  return out;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Row = { label: string; value: string; delta?: Delta | null; note?: string };
type Section = { title: string; rows: Row[]; footnote?: string };

const pctText = (n: number | null) => (n === null ? "—" : `${n}%`);
const points = (n: number) => `${n} pt`;

function surveyRows(cur: MonthlyStats, prev: MonthlyStats): Row[] {
  const v = cur.satisfaction.surveys;
  if (!v) return [];
  if (v.answered === 0) {
    return [{ label: "Sondaggio di gradimento", value: "Nessuna risposta", note: `${v.sent} inviati nel mese` }];
  }
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
  const curNps = nps(cur);
  return [
    {
      label: "NPS (sondaggio di gradimento)",
      value: curNps === null ? "—" : signed(curNps),
      delta: delta(curNps, nps(prev)),
      note: `${v.promoters} promotori · ${v.detractors} detrattori`,
    },
    {
      label: "Voto medio",
      value: v.avg_score === null ? "—" : `${String(v.avg_score).replace(".", ",")} / 10`,
      note: `${v.answered} ${v.answered === 1 ? "risposta" : "risposte"}${
        v.sent > 0 ? ` · ${pct(v.answered, v.sent)}% di risposta sui ${v.sent} inviati` : ""
      }`,
    },
  ];
}

export function reportSections(month: string, cur: MonthlyStats, prev: MonthlyStats): Section[] {
  const c = cur.cancellations;
  const reasons = c.by_reason
    .map((r) => `${CANCELLATION_REASON_LABELS[r.reason] ?? r.reason} ${r.count}`)
    .join(" · ");

  return [
    {
      title: "Iscrizioni",
      rows: [
        {
          label: "Nuove famiglie iscritte",
          value: String(cur.enrollments.families_won),
          delta: delta(cur.enrollments.families_won, prev.enrollments.families_won),
          note: "Lead passati ad Acquisito nel CRM",
        },
        {
          label: "Nuovi studenti nei gruppi",
          value: String(cur.enrollments.new_students),
          delta: delta(cur.enrollments.new_students, prev.enrollments.new_students),
        },
        { label: "Studenti attivi oggi", value: String(cur.active_students) },
      ],
    },
    {
      title: "Disdette",
      rows: [
        {
          label: "Disdette registrate",
          value: String(c.total),
          delta: delta(c.total, prev.cancellations.total, { higherIsBetter: false }),
          note: c.whole_family > 0 ? `${c.whole_family} di tutta la famiglia` : undefined,
        },
        ...(c.total > 0
          ? [
            { label: "Motivi", value: reasons },
            {
              label: "Tornerebbero?",
              value: `Sì ${c.would_return.yes} · Forse ${c.would_return.maybe} · No ${c.would_return.no}`,
            },
          ]
          : []),
      ],
    },
    {
      title: "Incassi",
      rows: [
        {
          label: "Incassato",
          value: euro(cur.revenue.paid_cents),
          delta: delta(cur.revenue.paid_cents, prev.revenue.paid_cents, { format: euro }),
          note: `${cur.revenue.paid_count} ${cur.revenue.paid_count === 1 ? "pagamento" : "pagamenti"}`,
        },
        {
          label: "Scaduto nel mese, da incassare",
          value: euro(cur.revenue.unpaid_cents),
          note: `${cur.revenue.unpaid_count} ${cur.revenue.unpaid_count === 1 ? "rata" : "rate"}`,
        },
      ],
    },
    {
      title: "Lezioni di prova",
      rows: [
        {
          label: "Richieste",
          value: String(cur.trials.requested),
          delta: delta(cur.trials.requested, prev.trials.requested),
        },
        {
          label: "Svolte",
          value: String(cur.trials.completed),
          delta: delta(cur.trials.completed, prev.trials.completed),
        },
        { label: "Annullate", value: String(cur.trials.cancelled) },
      ],
    },
    {
      title: "Conversione",
      rows: [
        {
          label: "Tasso di conversione",
          value: pctText(conversionRate(cur)),
          delta: delta(conversionRate(cur), conversionRate(prev), { format: points }),
          note: `${cur.conversion.won} acquisiti su ${cur.conversion.won + cur.conversion.lost} lead chiusi`,
        },
        {
          label: "Prove del mese già iscritte",
          value: `${cur.trials.converted} su ${cur.trials.requested}`,
        },
      ],
    },
    {
      title: "Soddisfazione",
      rows: [
        ...surveyRows(cur, prev),
        {
          label: "Presenza media alle lezioni",
          value: pctText(attendanceRate(cur)),
          delta: delta(attendanceRate(cur), attendanceRate(prev), { format: points }),
          note: cur.satisfaction.attendance_justified > 0
            ? `${cur.satisfaction.attendance_justified} assenze giustificate`
            : undefined,
        },
        {
          label: "Studenti segnalati a rischio",
          value: String(cur.satisfaction.at_risk_flagged),
          delta: delta(cur.satisfaction.at_risk_flagged, prev.satisfaction.at_risk_flagged, { higherIsBetter: false }),
        },
      ],
      footnote: cur.satisfaction.surveys
        ? "NPS: % di voti 9-10 meno % di voti 0-6 (da −100 a +100)."
        : "Sondaggio di gradimento non attivo: presenza e studenti a rischio sono indicatori indiretti.",
    },
  ];
}

const TONE_COLOR: Record<Tone, string> = { good: "#059669", bad: "#dc2626", neutral: "#6b7280" };

export function buildReportEmail(opts: {
  month: string;
  cur: MonthlyStats;
  prev: MonthlyStats;
  siteUrl: string;
}): { subject: string; html: string; text: string } {
  const { month, cur, prev } = opts;
  const label = monthLabel(month);
  const vs = vsMonth(previousMonth(month));
  const subject = `📊 Report di ${label} · TECHLAND`;
  const sections = reportSections(month, cur, prev);
  const notes = highlights(month, cur, prev);
  const link = `${opts.siteUrl.replace(/\/$/, "")}/admin/crm`;

  const rowHtml = (r: Row) => `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px;">${escapeHtml(r.label)}${
    r.note ? `<br><span style="color:#9ca3af;font-size:12px;">${escapeHtml(r.note)}</span>` : ""
  }</td>
    <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-size:15px;font-weight:bold;color:#111827;${
    // I numeri restano su una riga, i testi lunghi (motivi delle disdette) vanno a capo
    r.value.length > 16 ? "padding-left:12px;" : "white-space:nowrap;"
  }">${escapeHtml(r.value)}</td>
    <td style="padding:8px 0 8px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;white-space:nowrap;color:${
    r.delta ? TONE_COLOR[r.delta.tone] : "#9ca3af"
  };">${r.delta ? escapeHtml(r.delta.text) : ""}</td></tr>`;

  const sectionHtml = (s: Section) => `<h2 style="margin:24px 0 4px;font-size:16px;color:#059669;">${escapeHtml(s.title)}</h2>
  <table role="presentation" style="width:100%;border-collapse:collapse;">${s.rows.map(rowHtml).join("")}</table>${
    s.footnote ? `<p style="margin:6px 0 0;color:#9ca3af;font-size:12px;">${escapeHtml(s.footnote)}</p>` : ""
  }`;

  const notesHtml = notes.length
    ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;margin:0 0 8px;">
    <p style="margin:0 0 6px;font-weight:bold;font-size:14px;color:#92400e;">Da notare</p>
    <ul style="margin:0;padding-left:18px;color:#78350f;font-size:14px;line-height:1.5;">${
      notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")
    }</ul></div>`
    : "";

  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;background:#ffffff;border-radius:16px;overflow:hidden;">
  <tr><td style="background:linear-gradient(135deg,#10b981 0%,#06b6d4 100%);padding:28px 24px;text-align:center;">
  <h1 style="color:#ffffff;margin:0;font-size:22px;">Report di ${escapeHtml(label)}</h1>
  <p style="color:#ecfeff;margin:6px 0 0;font-size:14px;">A destra di ogni numero la differenza ${escapeHtml(vs)}</p></td></tr>
  <tr><td style="padding:24px;color:#1f2937;">
  ${notesHtml}
  ${sections.map(sectionHtml).join("\n")}
  <p style="margin:28px 0 0;"><a href="${link}" style="color:#059669;font-weight:bold;">Apri il CRM →</a></p>
  </td></tr>
  <tr><td style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Report automatico del primo del mese · techlanditalia.it</td></tr>
  </table></td></tr></table></body></html>`;

  const text = [
    `Report di ${label} (tra parentesi le differenze ${vs})`,
    ...(notes.length ? ["", "Da notare:", ...notes.map((n) => `- ${n}`)] : []),
    ...sections.flatMap((s) => [
      "",
      s.title.toUpperCase(),
      ...s.rows.map((r) => `${r.label}: ${r.value}${r.delta ? ` (${r.delta.text})` : ""}${r.note ? ` — ${r.note}` : ""}`),
      ...(s.footnote ? [s.footnote] : []),
    ]),
    "",
    `Apri il CRM: ${link}`,
  ].join("\n");

  return { subject, html, text };
}
