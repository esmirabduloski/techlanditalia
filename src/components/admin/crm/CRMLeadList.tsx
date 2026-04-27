import { useMemo, useState } from "react";
import { CrmLead, PIPELINE_STAGES, SOURCE_LABELS, LeadSource, PipelineStage } from "@/hooks/useCRM";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Props {
  leads: CrmLead[];
  onSelectLead: (lead: CrmLead) => void;
}

export function CRMLeadList({ leads, onSelectLead }: Props) {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "all">("all");
  const [stageFilter, setStageFilter] = useState<PipelineStage | "all">("all");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return leads.filter((l) => {
      if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
      if (stageFilter !== "all" && l.pipeline_stage !== stageFilter) return false;
      if (overdueOnly) {
        if (!l.next_followup_at || new Date(l.next_followup_at) >= new Date()) return false;
      }
      if (!q) return true;
      return (
        l.email.toLowerCase().includes(q) ||
        (l.full_name || "").toLowerCase().includes(q) ||
        (l.phone || "").toLowerCase().includes(q) ||
        (l.notes || "").toLowerCase().includes(q) ||
        l.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [leads, search, sourceFilter, stageFilter, overdueOnly]);

  const exportCSV = () => {
    const header = ["Nome", "Email", "Telefono", "Sorgente", "Stage", "Tag", "Follow-up", "Note", "Creato"];
    const rows = filtered.map((l) => [
      l.full_name, l.email, l.phone ?? "", SOURCE_LABELS[l.source],
      PIPELINE_STAGES.find(s => s.value === l.pipeline_stage)?.label ?? l.pipeline_stage,
      l.tags.join("; "), l.next_followup_at ?? "", (l.notes ?? "").replace(/\n/g, " "),
      format(new Date(l.created_at), "yyyy-MM-dd HH:mm"),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm-leads-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cerca per nome, email, tag..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as any)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sorgente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le sorgenti</SelectItem>
            {(Object.keys(SOURCE_LABELS) as LeadSource[]).map((s) => (
              <SelectItem key={s} value={s}>{SOURCE_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as any)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stage</SelectItem>
            {PIPELINE_STAGES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant={overdueOnly ? "default" : "outline"} size="sm" onClick={() => setOverdueOnly(!overdueOnly)}>
          <AlertCircle className="w-4 h-4 mr-1" /> Follow-up scaduti
        </Button>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="w-4 h-4 mr-1" /> CSV
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">{filtered.length} lead</div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Nome</th>
                <th className="text-left p-3 font-medium">Email</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Telefono</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Sorgente</th>
                <th className="text-left p-3 font-medium">Stage</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Follow-up</th>
                <th className="text-left p-3 font-medium hidden xl:table-cell">Creato</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const stage = PIPELINE_STAGES.find(s => s.value === l.pipeline_stage)!;
                const overdue = l.next_followup_at && new Date(l.next_followup_at) < new Date();
                return (
                  <tr key={l.id} onClick={() => onSelectLead(l)} className="border-t cursor-pointer hover:bg-muted/30">
                    <td className="p-3 font-medium">{l.full_name || "—"}</td>
                    <td className="p-3 text-muted-foreground">{l.email}</td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell">{l.phone || "—"}</td>
                    <td className="p-3 hidden lg:table-cell"><Badge variant="outline">{SOURCE_LABELS[l.source]}</Badge></td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                        <span>{stage.label}</span>
                      </div>
                    </td>
                    <td className={`p-3 hidden lg:table-cell ${overdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                      {l.next_followup_at ? format(new Date(l.next_followup_at), "dd MMM HH:mm", { locale: it }) : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground hidden xl:table-cell">
                      {format(new Date(l.created_at), "dd MMM yyyy", { locale: it })}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nessun lead trovato</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
