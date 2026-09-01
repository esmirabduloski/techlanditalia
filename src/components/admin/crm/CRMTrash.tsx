import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Trash2, RotateCcw, ChevronDown, X } from "lucide-react";
import { CrmLead } from "@/hooks/useCRM";

interface CRMTrashProps {
  trashedLeads: CrmLead[];
  onRestore: (id: string) => Promise<boolean>;
  onPermanentDelete: (id: string) => Promise<boolean>;
  onEmptyTrash: () => Promise<boolean>;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function CRMTrash({
  trashedLeads,
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
}: CRMTrashProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-6">
      <div className="flex items-center justify-between gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Trash2 className="w-4 h-4 mr-1" />
            Cestino ({trashedLeads.length})
            <ChevronDown
              className={`w-4 h-4 ml-1 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </Button>
        </CollapsibleTrigger>
        {open && trashedLeads.length > 0 && (
          <Button variant="destructive" size="sm" onClick={() => onEmptyTrash()}>
            <X className="w-4 h-4 mr-1" /> Svuota cestino
          </Button>
        )}
      </div>

      <CollapsibleContent className="mt-3">
        {trashedLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1">Il cestino è vuoto.</p>
        ) : (
          <div className="space-y-2">
            {trashedLeads.map((lead) => (
              <Card
                key={lead.id}
                className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{lead.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Creato il {formatDate(lead.created_at)} · Eliminato il{" "}
                    {formatDate(lead.deleted_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => onRestore(lead.id)}>
                    <RotateCcw className="w-4 h-4 mr-1" /> Recupera
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onPermanentDelete(lead.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Elimina
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
