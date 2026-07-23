import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Loader2, Plus, LogOut, KanbanSquare, List, BarChart3, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { JsonImportExport } from "@/components/admin/JsonImportExport";

export default function AdminCRM() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { leads, loading, updateLead, deleteLead, createLead, reload } = useCRMLeads();

  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const handleSelectLead = (lead: CrmLead) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  };

  // when leads list refreshes, sync currently-selected lead
  const liveSelected = selectedLead ? leads.find(l => l.id === selectedLead.id) ?? selectedLead : null;

  const handleCreate = async () => {
    if (!newEmail.trim()) {
      toast({ title: "Email obbligatoria", variant: "destructive" });
      return;
    }
    const ok = await createLead({ full_name: newName, email: newEmail, phone: newPhone || null, source: "manual" });
    if (ok) {
      setCreateOpen(false);
      setNewName(""); setNewEmail(""); setNewPhone("");
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
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nuovo lead
            </Button>
            <JsonImportExport
              filePrefix="crm-leads"
              tableName="crm_leads"
              conflictColumn="email"
              stripColumns={["notion_page_id", "notion_last_sync_at", "notion_sync_error"]}
              entityLabel="lead"
              onImported={reload}
            />
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
          <Tabs defaultValue="kanban">
            <TabsList className="mb-4">
              <TabsTrigger value="kanban"><KanbanSquare className="w-4 h-4 mr-1" /> Pipeline</TabsTrigger>
              <TabsTrigger value="list"><List className="w-4 h-4 mr-1" /> Lista</TabsTrigger>
              <TabsTrigger value="analytics"><BarChart3 className="w-4 h-4 mr-1" /> Analytics</TabsTrigger>
              <TabsTrigger value="notion"><Database className="w-4 h-4 mr-1" /> Notion</TabsTrigger>
            </TabsList>
            <TabsContent value="kanban">
              <CRMKanbanBoard
                leads={leads}
                onSelectLead={handleSelectLead}
                onMoveLead={(id, stage) => updateLead(id, { pipeline_stage: stage })}
              />
            </TabsContent>
            <TabsContent value="list">
              <CRMLeadList leads={leads} onSelectLead={handleSelectLead} />
            </TabsContent>
            <TabsContent value="analytics">
              <CRMAnalytics leads={leads} />
            </TabsContent>
            <TabsContent value="notion">
              <CRMNotionSettings totalLeads={leads.length} />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <CRMLeadDetailDrawer
        lead={liveSelected}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
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
