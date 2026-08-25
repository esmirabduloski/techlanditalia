import { useState } from "react";
import { CrmLead, SOURCE_LABELS } from "@/hooks/useCRM";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, ChevronDown, ChevronRight, RotateCcw, XCircle } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Props {
  trashedLeads: CrmLead[];
  onRestore: (id: string) => Promise<boolean>;
  onPermanentDelete: (id: string) => Promise<boolean>;
  onEmptyTrash: () => Promise<boolean>;
}

export function CRMTrash({ trashedLeads, onRestore, onPermanentDelete, onEmptyTrash }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border rounded-lg bg-muted/20">
      <div className="flex items-center justify-between gap-2 p-3">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Trash2 className="w-4 h-4" />
            <span>Cestino</span>
            <Badge variant="secondary">{trashedLeads.length}</Badge>
          </Button>
        </CollapsibleTrigger>
        {trashedLeads.length > 0 && (
          <Button variant="destructive" size="sm" onClick={() => setConfirmEmpty(true)}>
            <XCircle className="w-4 h-4 mr-1" /> Svuota cestino
          </Button>
        )}
      </div>

      <CollapsibleContent>
        <div className="border-t">
          {trashedLeads.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">Il cestino è vuoto</p>
          ) : (
            <div className="divide-y">
              {trashedLeads.map((l) => (
                <div key={l.id} className="p-3 flex flex-wrap items-center gap-2">
                  <div className="min-w-[180px] flex-1">
                    <div className="font-medium text-sm">{l.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground break-all">{l.email}</div>
                  </div>
                  <Badge variant="outline" className="text-xs">{SOURCE_LABELS[l.source]}</Badge>
                  <div className="text-xs text-muted-foreground">
                    Eliminato il{" "}
                    {l.deleted_at ? format(new Date(l.deleted_at), "dd MMM yyyy HH:mm", { locale: it }) : "—"}
                  </div>
                  <div className="flex gap-2 ml-auto">
                    <Button variant="outline" size="sm" onClick={() => onRestore(l.id)}>
                      <RotateCcw className="w-4 h-4 mr-1" /> Recupera
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setConfirmDeleteId(l.id)}>
                      <Trash2 className="w-4 h-4 mr-1" /> Elimina
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>

      <AlertDialog open={confirmEmpty} onOpenChange={setConfirmEmpty}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Svuotare il cestino?</AlertDialogTitle>
            <AlertDialogDescription>
              Verranno eliminati definitivamente {trashedLeads.length} lead. L'operazione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => onEmptyTrash()}>Svuota</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare definitivamente questo lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Il lead e la sua cronologia verranno rimossi per sempre.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmDeleteId) await onPermanentDelete(confirmDeleteId);
                setConfirmDeleteId(null);
              }}
            >
              Elimina definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
}
