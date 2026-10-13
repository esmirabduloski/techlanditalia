import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { shortDate } from "@/lib/subscriptionPause";
import {
  SURVEY_KIND_LABELS,
  npsBand,
  summarizeSurveys,
  type SatisfactionSurvey,
  type SurveyKind,
} from "@/lib/satisfactionSurvey";

type Row = SatisfactionSurvey & { student: { full_name: string } | null };

const BAND_STYLES = {
  promoter: "bg-green-500",
  passive: "bg-amber-400",
  detractor: "bg-red-500",
} as const;

/** Soddisfazione delle famiglie: risposte al sondaggio automatico (ultimi 12 mesi). */
export function CRMSatisfactionStats() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    const since = new Date(Date.now() - 365 * 86_400_000).toISOString();
    supabase
      .from("satisfaction_surveys")
      .select("*, student:profiles!satisfaction_surveys_student_id_fkey(full_name)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, []);

  if (!rows) return null;
  const s = summarizeSurveys(rows);
  const comments = rows.filter((r) => r.status === "answered" && r.comment?.trim()).slice(0, 6);

  return (
    <Card data-testid="crm-satisfaction-stats">
      <CardHeader>
        <CardTitle className="text-base">Soddisfazione delle famiglie</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {s.sent === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessun sondaggio ancora. Partono in automatico il giorno dopo la terza lezione e dopo l'ultima lezione di ogni modulo.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Stat label="NPS" value={s.nps === null ? "—" : String(s.nps)} hint="promotori − detrattori" />
              <Stat label="Voto medio" value={s.average === null ? "—" : `${s.average}/10`} />
              <Stat label="Risposte" value={`${s.answered}/${s.sent}`} hint={`${s.responseRate}%`} />
              <Stat label="Promotori" value={String(s.promoters)} hint="voto 9-10" />
            </div>

            {s.answered > 0 && (
              <div>
                <div className="flex h-3 rounded-full overflow-hidden bg-muted" aria-hidden="true">
                  {(["promoter", "passive", "detractor"] as const).map((band) => {
                    const n = band === "promoter" ? s.promoters : band === "passive" ? s.passives : s.detractors;
                    return <div key={band} className={BAND_STYLES[band]} style={{ width: `${(n / s.answered) * 100}%` }} />;
                  })}
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-1.5">
                  <span>Promotori (9-10): <strong className="text-foreground">{s.promoters}</strong></span>
                  <span>Passivi (7-8): <strong className="text-foreground">{s.passives}</strong></span>
                  <span>Detrattori (0-6): <strong className="text-foreground">{s.detractors}</strong></span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-4 text-sm">
              {(Object.keys(SURVEY_KIND_LABELS) as SurveyKind[]).map((k) => (
                <span key={k}>
                  {SURVEY_KIND_LABELS[k]}:{" "}
                  <strong>{s.byKind[k].average === null ? "—" : `${s.byKind[k].average}/10`}</strong>{" "}
                  <span className="text-muted-foreground">({s.byKind[k].answered} risposte)</span>
                </span>
              ))}
            </div>

            {comments.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Ultimi commenti</div>
                <ul className="space-y-1.5 text-sm">
                  {comments.map((r) => (
                    <li key={r.id} className="border-l-2 border-muted pl-3">
                      <Badge variant="outline" className="mr-2 gap-1 font-normal">
                        <span className={`w-2 h-2 rounded-full ${BAND_STYLES[npsBand(r.score ?? 0)]}`} />
                        {r.score}/10
                      </Badge>
                      “{r.comment}”{" "}
                      <span className="text-muted-foreground">
                        · {r.student?.full_name ?? "studente"}, {SURVEY_KIND_LABELS[r.kind].toLowerCase()}
                        {r.answered_at ? `, ${shortDate(r.answered_at.slice(0, 10))}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
