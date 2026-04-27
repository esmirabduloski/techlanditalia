import { CrmLead, PIPELINE_STAGES, SOURCE_LABELS, LeadSource } from "@/hooks/useCRM";
import { useCRMStats } from "@/hooks/useCRM";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, AlertCircle, Trophy, XCircle } from "lucide-react";

interface Props { leads: CrmLead[] }

export function CRMAnalytics({ leads }: Props) {
  const stats = useCRMStats(leads);
  const totalForBars = stats.total || 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={<Users className="w-4 h-4" />} label="Totale lead" value={stats.total} />
        <StatCard icon={<TrendingUp className="w-4 h-4" />} label="In funnel" value={stats.inFunnel} color="text-blue-500" />
        <StatCard icon={<Trophy className="w-4 h-4" />} label="Acquisiti" value={stats.won} color="text-green-500" />
        <StatCard icon={<XCircle className="w-4 h-4" />} label="Persi" value={stats.lost} color="text-red-500" />
        <StatCard icon={<AlertCircle className="w-4 h-4" />} label="FU scaduti" value={stats.overdueFollowups} color="text-amber-500" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Tasso di conversione</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{stats.conversionRate.toFixed(1)}%</span>
            <span className="text-muted-foreground text-sm">su lead chiusi (won + lost)</span>
          </div>
          <div className="mt-3 h-3 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-green-500 transition-all" style={{ width: `${stats.conversionRate}%` }} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Distribuzione pipeline</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {PIPELINE_STAGES.map((s) => {
            const count = stats.byStage[s.value];
            const pct = (count / totalForBars) * 100;
            return (
              <div key={s.value}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${s.color}`} />{s.label}</span>
                  <span className="text-muted-foreground">{count} ({pct.toFixed(0)}%)</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${s.color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Lead per sorgente</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(Object.keys(SOURCE_LABELS) as LeadSource[]).map((src) => {
            const count = stats.bySource[src];
            const pct = (count / totalForBars) * 100;
            return (
              <div key={src}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{SOURCE_LABELS[src]}</span>
                  <span className="text-muted-foreground">{count} ({pct.toFixed(0)}%)</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`flex items-center gap-2 text-xs text-muted-foreground ${color || ""}`}>
          {icon}{label}
        </div>
        <div className={`text-2xl font-bold mt-1 ${color || ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
