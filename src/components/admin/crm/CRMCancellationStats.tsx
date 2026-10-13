import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { shortDate } from "@/lib/subscriptionPause";
import {
  CANCELLATION_REASON_LABELS,
  WOULD_RETURN_LABELS,
  summarizeCancellations,
  type SubscriptionCancellation,
  type WouldReturn,
} from "@/lib/subscriptionCancellation";

/** Perché le famiglie disdicono: risposte al questionario di disdetta. */
export function CRMCancellationStats() {
  const [rows, setRows] = useState<SubscriptionCancellation[] | null>(null);

  useEffect(() => {
    supabase
      .from("subscription_cancellations")
      .select("*")
      .order("cancelled_on", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as SubscriptionCancellation[]));
  }, []);

  if (!rows) return null;
  const summary = summarizeCancellations(rows);
  const suggestions = rows.filter((r) => r.would_have_stayed?.trim()).slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Perché le famiglie disdicono</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {summary.total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessuna disdetta registrata. Quando una famiglia disdice, usa "Registra disdetta" nella sua scheda.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {summary.reasons.map(({ reason, count }) => {
                const pct = (count / summary.total) * 100;
                return (
                  <div key={reason}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{CANCELLATION_REASON_LABELS[reason]}</span>
                      <span className="text-muted-foreground">{count} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-red-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Tornerebbero in futuro?</div>
              <div className="flex flex-wrap gap-4 text-sm">
                {(Object.keys(WOULD_RETURN_LABELS) as WouldReturn[]).map((r) => (
                  <span key={r}>
                    {WOULD_RETURN_LABELS[r]}: <strong>{summary.byReturn[r]}</strong>
                  </span>
                ))}
              </div>
            </div>

            {suggestions.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Cosa li avrebbe fatti restare</div>
                <ul className="space-y-1.5 text-sm">
                  {suggestions.map((r) => (
                    <li key={r.id} className="border-l-2 border-muted pl-3">
                      “{r.would_have_stayed}”{" "}
                      <span className="text-muted-foreground">
                        · {CANCELLATION_REASON_LABELS[r.reason]}, {shortDate(r.cancelled_on)}
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
