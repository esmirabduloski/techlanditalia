import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCRMLeads, CrmLead } from "@/hooks/useCRM";
import { CRMKanbanBoard } from "@/components/admin/crm/CRMKanbanBoard";
import { CRMLeadList } from "@/components/admin/crm/CRMLeadList";
import { CRMAnalytics } from "@/components/admin/crm/CRMAnalytics";
import { CRMLeadDetailDrawer } from "@/components/admin/crm/CRMLeadDetailDrawer";
import { CRMNotionSettings } from "@/components/admin/crm/CRMNotionSettings";
import { CRMTrash } from "@/components/admin/crm/CRMTrash";
import { CRMCourseSelect } from "@/components/admin/crm/CRMCourseSelect";
import { CRMPaymentsSchedule } from "@/components/admin/crm/payments/CRMPaymentsSchedule";
import { useAllScheduledPayments } from "@/hooks/useCRMPayments";
import { todayIso } from "@/lib/payments";
import { Loader2, Plus, LogOut, KanbanSquare, List, BarChart3, Database, CalendarClock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminCRM() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    leads,
    trashedLeads,
    loading,
    updateLead,
    deleteLead,
    restoreLead,
    permanentlyDeleteLead,
    emptyTrash,
    createLead,
  } = useCRMLeads();

  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newInterest, setNewInterest] = useState<string | null>(null);

  const handleSelectLead = (lead: CrmLead) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  };

  // ?lead=<id> (es. dalla notifica push di un pagamento) apre direttamente la scheda
  const [searchParams, setSearchParams] = useSearchParams();
  const leadParam = searchParams.get("lead");
  // ?tab=scadenziario (dalla notifica dei solleciti) apre lo Scadenziario
  const [tab, setTab] = useState(searchParams.get("tab") ?? "kanban");
  const schedule = useAllScheduledPayments();
  const today = todayIso();
  const overdueCount = schedule.payments.filter(p => p.due_date && p.due_date < today).length;

  const openLeadById = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (lead) handleSelectLead(lead);
    else toast({ title: "Cliente non trovato", description: "Potrebbe essere nel cestino.", variant: "destructive" });
  };
  useEffect(() => {
    if (!leadParam || loading) return;
    const lead = leads.find(l => l.id === leadParam);
    if (lead) handleSelectLead(lead);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete("lead");
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadParam, loading, leads]);

  // when leads list refreshes, sync currently-selected lead
  const liveSelected = selectedLead ? leads.find(l => l.id === selectedLead.id) ?? selectedLead : null;

  const handleCreate = async () => {
    if (!newEmail.trim()) {
      toast({ title: "Email obbligatoria", variant: "destructive" });
      return;
    }
    const ok = await createLead({
      full_name: newName,
      email: newEmail,
      phone: newPhone || null,
      interest: newInterest,
      source: "manual",
    });
    if (ok) {
      setCreateOpen(false);
      setNewName(""); setNewEmail(""); setNewPhone(""); setNewInterest(null);
      toast({ title: "Lead creato" });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nuovo lead
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-1" /> Esci
          </Button>
        </div>
      </div>
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4 h-auto flex-wrap">
              <TabsTrigger value="kanban"><KanbanSquare className="w-4 h-4 mr-1" /> Pipeline</TabsTrigger>
              <TabsTrigger value="list"><List className="w-4 h-4 mr-1" /> Lista</TabsTrigger>
              <TabsTrigger value="scadenziario">
                <CalendarClock className="w-4 h-4 mr-1" /> Scadenziario
                {overdueCount > 0 && (
                  <span
                    className="ml-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 min-w-[1.25rem] leading-5"
                    aria-label={`${overdueCount} rate scadute`}
                  >
                    {overdueCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="analytics"><BarChart3 className="w-4 h-4 mr-1" /> Analytics</TabsTrigger>
              <TabsTrigger value="notion"><Database className="w-4 h-4 mr-1" /> Notion</TabsTrigger>
            </TabsList>
            <TabsContent value="kanban">
              <CRMKanbanBoard
                leads={leads}
                onSelectLead={handleSelectLead}
                onMoveLead={(id, stage) => updateLead(id, { pipeline_stage: stage })}
                onSetInterest={async (id, interest) => {
                  const ok = await updateLead(id, { interest });
                  if (ok) toast({ title: "Corso assegnato al lead" });
                }}
              />
            </TabsContent>
            <TabsContent value="list">
              <CRMLeadList leads={leads} onSelectLead={handleSelectLead} />
            </TabsContent>
            <TabsContent value="scadenziario">
              <CRMPaymentsSchedule schedule={schedule} onOpenLead={openLeadById} />
            </TabsContent>
            <TabsContent value="analytics">
              <CRMAnalytics leads={leads} />
            </TabsContent>
            <TabsContent value="notion">
              <CRMNotionSettings totalLeads={leads.length} />
            </TabsContent>
          </Tabs>
        )}

        {!loading && (
          <CRMTrash
            trashedLeads={trashedLeads}
            onRestore={restoreLead}
            onPermanentDelete={permanentlyDeleteLead}
            onEmptyTrash={emptyTrash}
          />
        )}
      </main>

      <CRMLeadDetailDrawer
        lead={liveSelected}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          // I pagamenti modificati nella scheda si riflettono nello scadenziario
          schedule.reload();
        }}
        onUpdate={updateLead}
        onDelete={deleteLead}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuovo lead manuale</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
            <div><Label>Email *</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
            <div><Label>Telefono</Label><Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} /></div>
            <div>
              <Label>Corso di interesse</Label>
              <CRMCourseSelect value={newInterest} onChange={setNewInterest} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
            <Button onClick={handleCreate}>Crea</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
