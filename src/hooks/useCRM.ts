import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type PipelineStage = "new" | "contacted" | "qualified" | "proposal_sent" | "won" | "lost" | "nurture";
export type LeadSource = "trial_booking" | "contact_form" | "newsletter" | "registered" | "manual" | "import";
export type InteractionType = "email" | "whatsapp" | "call" | "note" | "quote_sent" | "meeting" | "status_change" | "sms";

export interface CrmLead {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  source: LeadSource;
  pipeline_stage: PipelineStage;
  assigned_to: string | null;
  tags: string[];
  lead_score: number;
  lifetime_value_cents: number;
  next_followup_at: string | null;
  last_contacted_at: string | null;
  notes: string | null;
  linked_profile_id: string | null;
  quote_genie_client_id: string | null;
  source_record_id: string | null;
  child_age: number | null;
  interest: string | null;
  original_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmInteraction {
  id: string;
  lead_id: string;
  admin_id: string | null;
  type: InteractionType;
  subject: string | null;
  content: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export const PIPELINE_STAGES: { value: PipelineStage; label: string; color: string }[] = [
  { value: "new", label: "Nuovo", color: "bg-slate-500" },
  { value: "contacted", label: "Contattato", color: "bg-blue-500" },
  { value: "qualified", label: "Qualificato", color: "bg-cyan-500" },
  { value: "proposal_sent", label: "Preventivo inviato", color: "bg-purple-500" },
  { value: "won", label: "Cliente acquisito", color: "bg-green-500" },
  { value: "lost", label: "Perso", color: "bg-red-500" },
  { value: "nurture", label: "Nurturing", color: "bg-amber-500" },
];

export const SOURCE_LABELS: Record<LeadSource, string> = {
  trial_booking: "Prenotazione prova",
  contact_form: "Form contatti",
  newsletter: "Newsletter",
  registered: "Registrato",
  manual: "Aggiunto manualmente",
  import: "Importato",
};

export function useCRMLeads() {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("crm_leads" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) {
      toast({ title: "Errore caricamento CRM", description: error.message, variant: "destructive" });
    } else {
      setLeads((data ?? []) as unknown as CrmLead[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("crm_leads_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_leads" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateLead = async (id: string, patch: Partial<CrmLead>) => {
    const { error } = await supabase.from("crm_leads" as any).update(patch).eq("id", id);
    if (error) {
      toast({ title: "Errore aggiornamento", description: error.message, variant: "destructive" });
      return false;
    }
    await load();
    return true;
  };

  const deleteLead = async (id: string) => {
    const { error } = await supabase.from("crm_leads" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Errore eliminazione", description: error.message, variant: "destructive" });
      return false;
    }
    await load();
    return true;
  };

  const createLead = async (lead: Partial<CrmLead>) => {
    const { error } = await supabase.from("crm_leads" as any).insert({
      ...lead,
      email: (lead.email || "").toLowerCase(),
      source: lead.source ?? "manual",
    } as any);
    if (error) {
      toast({ title: "Errore creazione lead", description: error.message, variant: "destructive" });
      return false;
    }
    await load();
    return true;
  };

  return { leads, loading, reload: load, updateLead, deleteLead, createLead };
}

export function useCRMInteractions(leadId: string | null) {
  const [interactions, setInteractions] = useState<CrmInteraction[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    if (!leadId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("crm_interactions" as any)
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Errore timeline", description: error.message, variant: "destructive" });
    } else {
      setInteractions((data ?? []) as unknown as CrmInteraction[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (leadId) load();
    else setInteractions([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const addInteraction = async (input: Partial<CrmInteraction>) => {
    if (!leadId) return false;
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from("crm_interactions" as any).insert({
      lead_id: leadId,
      admin_id: user?.id,
      type: input.type ?? "note",
      subject: input.subject ?? null,
      content: input.content ?? null,
      metadata: input.metadata ?? {},
    } as any);
    if (error) {
      toast({ title: "Errore salvataggio interazione", description: error.message, variant: "destructive" });
      return false;
    }
    // also bump last_contacted_at
    if (input.type && ["email", "whatsapp", "call", "sms", "meeting"].includes(input.type)) {
      await supabase.from("crm_leads" as any).update({ last_contacted_at: new Date().toISOString() }).eq("id", leadId);
    }
    await load();
    return true;
  };

  return { interactions, loading, reload: load, addInteraction };
}

export function useCRMStats(leads: CrmLead[]) {
  return useMemo(() => {
    const byStage: Record<PipelineStage, number> = {
      new: 0, contacted: 0, qualified: 0, proposal_sent: 0, won: 0, lost: 0, nurture: 0,
    };
    const bySource: Record<LeadSource, number> = {
      trial_booking: 0, contact_form: 0, newsletter: 0, registered: 0, manual: 0, import: 0,
    };
    leads.forEach((l) => {
      byStage[l.pipeline_stage]++;
      bySource[l.source]++;
    });
    const total = leads.length;
    const won = byStage.won;
    const lost = byStage.lost;
    const inFunnel = total - won - lost;
    const conversionRate = (won + lost) > 0 ? (won / (won + lost)) * 100 : 0;
    const overdueFollowups = leads.filter(
      (l) => l.next_followup_at && new Date(l.next_followup_at) < new Date()
    ).length;
    return { byStage, bySource, total, won, lost, inFunnel, conversionRate, overdueFollowups };
  }, [leads]);
}
