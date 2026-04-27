import { useState } from "react";
import { CrmLead, PIPELINE_STAGES, PipelineStage, SOURCE_LABELS, useCRMInteractions, InteractionType } from "@/hooks/useCRM";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Mail, Phone, MessageCircle, FileText, Plus, Trash2, ExternalLink,
  Calendar, Clock, User, Tag as TagIcon, FileSignature, X, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Props {
  lead: CrmLead | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<CrmLead>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

const interactionIcons: Record<InteractionType, React.ReactNode> = {
  email: <Mail className="w-4 h-4" />,
  whatsapp: <MessageCircle className="w-4 h-4" />,
  call: <Phone className="w-4 h-4" />,
  note: <FileText className="w-4 h-4" />,
  quote_sent: <FileSignature className="w-4 h-4" />,
  meeting: <Calendar className="w-4 h-4" />,
  status_change: <Clock className="w-4 h-4" />,
  sms: <MessageCircle className="w-4 h-4" />,
};

const interactionLabels: Record<InteractionType, string> = {
  email: "Email", whatsapp: "WhatsApp", call: "Chiamata", note: "Nota",
  quote_sent: "Preventivo", meeting: "Meeting", status_change: "Cambio stato", sms: "SMS",
};

export function CRMLeadDetailDrawer({ lead, open, onClose, onUpdate, onDelete }: Props) {
  const { toast } = useToast();
  const { interactions, addInteraction } = useCRMInteractions(lead?.id ?? null);
  const [savingQuote, setSavingQuote] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // local form state for new interaction
  const [intType, setIntType] = useState<InteractionType>("note");
  const [intSubject, setIntSubject] = useState("");
  const [intContent, setIntContent] = useState("");

  // local edit state
  const [tagInput, setTagInput] = useState("");

  if (!lead) return null;

  const handleStageChange = async (stage: PipelineStage) => {
    await onUpdate(lead.id, { pipeline_stage: stage });
  };

  const handleAddTag = async () => {
    const t = tagInput.trim();
    if (!t || lead.tags.includes(t)) { setTagInput(""); return; }
    await onUpdate(lead.id, { tags: [...lead.tags, t] });
    setTagInput("");
  };

  const handleRemoveTag = async (tag: string) => {
    await onUpdate(lead.id, { tags: lead.tags.filter(t => t !== tag) });
  };

  const handleSaveInteraction = async () => {
    if (!intContent.trim() && !intSubject.trim()) {
      toast({ title: "Contenuto richiesto", variant: "destructive" });
      return;
    }
    const ok = await addInteraction({ type: intType, subject: intSubject || null, content: intContent || null });
    if (ok) {
      setIntSubject(""); setIntContent("");
      toast({ title: "Interazione registrata" });
    }
  };

  const handleQuoteGenie = async () => {
    setSavingQuote(true);
    try {
      const { data, error } = await supabase.functions.invoke("quote-genie-create-client", {
        body: { lead_id: lead.id },
      });
      if (error) throw error;
      if (data?.redirect_url) {
        window.open(data.redirect_url, "_blank", "noopener,noreferrer");
        if (data.fallback) {
          toast({ title: "Aperto Quote Genie (modalità fallback)", description: data.error || "API non disponibile, dati passati via URL" });
        } else {
          toast({ title: "Cliente creato in Quote Genie", description: "Aperta la pagina cliente in nuova tab" });
        }
      } else {
        throw new Error("Nessun URL di redirect ricevuto");
      }
    } catch (e: any) {
      toast({ title: "Errore", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setSavingQuote(false);
    }
  };

  const waLink = lead.phone
    ? `https://wa.me/${lead.phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(`Ciao ${lead.full_name?.split(" ")[0] || ""}, ti scrivo da TECHLAND.`)}`
    : null;
  const mailLink = `mailto:${lead.email}?subject=${encodeURIComponent("TECHLAND - " + (lead.full_name || ""))}`;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-2xl">{lead.full_name || "—"}</SheetTitle>
          <div className="flex flex-wrap gap-2 items-center text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>
            {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>}
            <Badge variant="outline">{SOURCE_LABELS[lead.source]}</Badge>
          </div>
        </SheetHeader>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button size="sm" variant="default" onClick={handleQuoteGenie} disabled={savingQuote}>
            {savingQuote ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileSignature className="w-4 h-4 mr-1" />}
            Crea Preventivo
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={mailLink}><Mail className="w-4 h-4 mr-1" /> Email</a>
          </Button>
          {waLink && (
            <Button size="sm" variant="outline" asChild>
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
              </a>
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} className="text-red-500 ml-auto">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Pipeline stage */}
        <div className="space-y-3 mb-6">
          <Label>Stage pipeline</Label>
          <Select value={lead.pipeline_stage} onValueChange={(v) => handleStageChange(v as PipelineStage)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PIPELINE_STAGES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${s.color}`} />{s.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tags */}
        <div className="space-y-2 mb-6">
          <Label className="flex items-center gap-1"><TagIcon className="w-3 h-3" /> Tag</Label>
          <div className="flex flex-wrap gap-1">
            {lead.tags.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1">
                {t}
                <button onClick={() => handleRemoveTag(t)}><X className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Aggiungi tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
            />
            <Button size="sm" onClick={handleAddTag}><Plus className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* Follow-up */}
        <div className="space-y-2 mb-6">
          <Label>Prossimo follow-up</Label>
          <Input
            type="datetime-local"
            value={lead.next_followup_at ? new Date(lead.next_followup_at).toISOString().slice(0, 16) : ""}
            onChange={(e) => onUpdate(lead.id, { next_followup_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
          />
        </div>

        {/* Notes */}
        <div className="space-y-2 mb-6">
          <Label>Note interne</Label>
          <Textarea
            rows={3}
            placeholder="Note libere..."
            defaultValue={lead.notes ?? ""}
            onBlur={(e) => e.target.value !== (lead.notes ?? "") && onUpdate(lead.id, { notes: e.target.value })}
          />
        </div>

        {/* Lead origin info */}
        {(lead.interest || lead.child_age || lead.original_message) && (
          <div className="mb-6 p-3 bg-muted/30 rounded-lg space-y-1 text-sm">
            <div className="font-semibold text-xs text-muted-foreground mb-2">Dati origine</div>
            {lead.interest && <div><strong>Interesse:</strong> {lead.interest}</div>}
            {lead.child_age && <div><strong>Età alunno:</strong> {lead.child_age} anni</div>}
            {lead.original_message && <div className="whitespace-pre-wrap"><strong>Messaggio:</strong> {lead.original_message}</div>}
          </div>
        )}

        {lead.linked_profile_id && (
          <div className="mb-6 p-3 bg-green-500/10 rounded-lg text-sm flex items-center gap-2">
            <User className="w-4 h-4 text-green-600" />
            <span>Cliente registrato sulla piattaforma</span>
          </div>
        )}

        <Separator className="my-6" />

        {/* New interaction */}
        <div className="space-y-3 mb-6">
          <Label className="text-base font-semibold">Aggiungi interazione</Label>
          <div className="grid grid-cols-2 gap-2">
            <Select value={intType} onValueChange={(v) => setIntType(v as InteractionType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(interactionLabels) as InteractionType[])
                  .filter(k => k !== "status_change")
                  .map(k => (
                    <SelectItem key={k} value={k}>{interactionLabels[k]}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Input placeholder="Oggetto (opz.)" value={intSubject} onChange={(e) => setIntSubject(e.target.value)} />
          </div>
          <Textarea rows={2} placeholder="Contenuto / dettagli..." value={intContent} onChange={(e) => setIntContent(e.target.value)} />
          <Button size="sm" onClick={handleSaveInteraction}><Plus className="w-4 h-4 mr-1" /> Registra</Button>
        </div>

        {/* Timeline */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Timeline</Label>
          {interactions.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">Nessuna interazione registrata</div>
          )}
          {interactions.map((i) => (
            <div key={i.id} className="flex gap-3 text-sm">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                {interactionIcons[i.type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-medium">{interactionLabels[i.type]}</span>
                  {i.subject && <span className="text-muted-foreground">— {i.subject}</span>}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(new Date(i.created_at), "dd MMM HH:mm", { locale: it })}
                  </span>
                </div>
                {i.content && <div className="text-muted-foreground whitespace-pre-wrap mt-1">{i.content}</div>}
                {i.metadata?.redirect_url && (
                  <a href={i.metadata.redirect_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs flex items-center gap-1 mt-1">
                    Apri preventivo <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminare il lead?</AlertDialogTitle>
              <AlertDialogDescription>
                Verranno cancellate anche tutte le interazioni associate. L'azione è irreversibile.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={async () => {
                const ok = await onDelete(lead.id);
                if (ok) onClose();
              }}>Elimina</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
