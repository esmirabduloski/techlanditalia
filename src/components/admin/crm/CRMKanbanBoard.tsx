import { useState } from "react";
import { CrmLead, PIPELINE_STAGES, PipelineStage, SOURCE_LABELS } from "@/hooks/useCRM";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertCircle, Calendar, Mail, Phone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface Props {
  leads: CrmLead[];
  onSelectLead: (lead: CrmLead) => void;
  onMoveLead: (leadId: string, newStage: PipelineStage) => void;
}

export function CRMKanbanBoard({ leads, onSelectLead, onMoveLead }: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<PipelineStage | null>(null);

  const grouped: Record<PipelineStage, CrmLead[]> = {
    new: [], contacted: [], qualified: [], proposal_sent: [], won: [], lost: [], nurture: [],
  };
  leads.forEach((l) => grouped[l.pipeline_stage].push(l));

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max">
        {PIPELINE_STAGES.map((stage) => (
          <div
            key={stage.value}
            className={`w-72 flex-shrink-0 rounded-lg bg-muted/40 p-2 transition-colors ${
              overStage === stage.value ? "ring-2 ring-primary bg-primary/5" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStage(stage.value);
            }}
            onDragLeave={() => setOverStage(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOverStage(null);
              if (draggedId) {
                onMoveLead(draggedId, stage.value);
                setDraggedId(null);
              }
            }}
          >
            <div className="flex items-center justify-between px-2 py-2 mb-2 sticky top-0 bg-muted/40 backdrop-blur z-10">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                <span className="font-semibold text-sm">{stage.label}</span>
              </div>
              <Badge variant="secondary" className="text-xs">{grouped[stage.value].length}</Badge>
            </div>
            <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
              {grouped[stage.value].map((lead) => (
                <Card
                  key={lead.id}
                  draggable
                  onDragStart={() => setDraggedId(lead.id)}
                  onDragEnd={() => setDraggedId(null)}
                  onClick={() => onSelectLead(lead)}
                  className="p-3 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <Avatar className="w-7 h-7">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {(lead.full_name || lead.email).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {lead.full_name || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {lead.email}
                      </div>
                    </div>
                  </div>
                  {lead.phone && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <Phone className="w-3 h-3" /> {lead.phone}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge variant="outline" className="text-[10px] py-0">
                      {SOURCE_LABELS[lead.source]}
                    </Badge>
                    {lead.tags.slice(0, 2).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px] py-0">{t}</Badge>
                    ))}
                  </div>
                  {lead.next_followup_at && (
                    <div
                      className={`mt-2 text-xs flex items-center gap-1 ${
                        new Date(lead.next_followup_at) < new Date() ? "text-red-500" : "text-muted-foreground"
                      }`}
                    >
                      {new Date(lead.next_followup_at) < new Date() ? (
                        <AlertCircle className="w-3 h-3" />
                      ) : (
                        <Calendar className="w-3 h-3" />
                      )}
                      Follow-up {formatDistanceToNow(new Date(lead.next_followup_at), { locale: it, addSuffix: true })}
                    </div>
                  )}
                </Card>
              ))}
              {grouped[stage.value].length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-6">Nessun lead</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
