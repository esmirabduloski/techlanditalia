import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { CrmPayment } from '@/lib/payments';

export type PaymentInsert = Partial<Omit<CrmPayment, 'id' | 'created_at' | 'updated_at'>> & {
  amount_cents: number;
};

const table = () => supabase.from('crm_payments');

/** Pagamenti e rate di un cliente CRM. */
export function useCRMPayments(leadId: string | null) {
  const [payments, setPayments] = useState<CrmPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    if (!leadId) {
      setPayments([]);
      return;
    }
    setLoading(true);
    const { data, error } = await table()
      .select('*')
      .eq('lead_id', leadId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true });
    if (error) {
      setLoadError(error.message);
    } else {
      setLoadError(null);
      setPayments((data ?? []) as unknown as CrmPayment[]);
    }
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  const fail = (title: string, error: { message: string }) => {
    toast({ title, description: error.message, variant: 'destructive' });
    return false;
  };

  const insertPayments = async (rows: PaymentInsert[]) => {
    if (!leadId) return false;
    const { error } = await table().insert(rows.map(r => ({ ...r, lead_id: leadId })));
    if (error) return fail('Errore salvataggio pagamento', error);
    await load();
    return true;
  };

  const updatePayment = async (id: string, patch: Partial<CrmPayment>) => {
    const { error } = await table().update(patch).eq('id', id);
    if (error) return fail('Errore aggiornamento pagamento', error);
    await load();
    return true;
  };

  /** Aggiorna più rate insieme (modifica in blocco di un piano). */
  const updateMany = async (rows: ({ id: string } & Partial<CrmPayment>)[]) => {
    const results = await Promise.all(rows.map(({ id, ...patch }) => table().update(patch).eq('id', id)));
    const failed = results.find(r => r.error);
    await load();
    if (failed?.error) return fail('Alcune rate non sono state aggiornate', failed.error);
    return true;
  };

  const deletePayment = async (id: string) => {
    const { error } = await table().delete().eq('id', id);
    if (error) return fail('Errore eliminazione pagamento', error);
    await load();
    return true;
  };

  /** Invia subito il promemoria push al cliente per una rata. */
  const sendClientReminderNow = async (id: string) => {
    const { data, error } = await supabase.functions.invoke('send-payment-reminders', { body: { paymentId: id } });
    await load();
    if (error) return { ok: false, result: error.message };
    return { ok: Boolean(data?.success), result: data?.result as string | undefined };
  };

  return {
    payments, loading, loadError, reload: load, insertPayments, updatePayment, updateMany, deletePayment, sendClientReminderNow,
  };
}

/** Il cliente collegato ha almeno un dispositivo con notifiche push attive? null = sconosciuto. */
export function useClientPushStatus(profileId: string | null) {
  const [hasDevices, setHasDevices] = useState<boolean | null>(null);

  useEffect(() => {
    if (!profileId) {
      setHasDevices(null);
      return;
    }
    let active = true;
    supabase
      .from('push_devices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profileId)
      .then(({ count, error }) => {
        if (active) setHasDevices(error ? null : (count ?? 0) > 0);
      });
    return () => {
      active = false;
    };
  }, [profileId]);

  return hasDevices;
}

export interface ScheduledPaymentWithLead extends CrmPayment {
  crm_leads: {
    full_name: string | null;
    email: string;
    phone: string | null;
    linked_profile_id: string | null;
    deleted_at: string | null;
  } | null;
}

/** Tutte le rate da incassare di tutti i clienti (Scadenziario). */
export function useAllScheduledPayments() {
  const [payments, setPayments] = useState<ScheduledPaymentWithLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const { data, error } = await table()
      .select('*, crm_leads(full_name, email, phone, linked_profile_id, deleted_at)')
      .eq('status', 'scheduled')
      .order('due_date', { ascending: true });
    if (error) {
      setLoadError(error.message);
    } else {
      setLoadError(null);
      // Le rate dei lead nel cestino non vanno sollecitate
      setPayments(((data ?? []) as unknown as ScheduledPaymentWithLead[]).filter(p => !p.crm_leads?.deleted_at));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updatePayment = async (id: string, patch: Partial<CrmPayment>) => {
    const { error } = await table().update(patch).eq('id', id);
    if (error) {
      toast({ title: 'Errore aggiornamento pagamento', description: error.message, variant: 'destructive' });
      return false;
    }
    await load();
    return true;
  };

  const sendClientReminderNow = async (id: string) => {
    const { data, error } = await supabase.functions.invoke('send-payment-reminders', { body: { paymentId: id } });
    await load();
    if (error) return { ok: false, result: error.message };
    return { ok: Boolean(data?.success), result: data?.result as string | undefined };
  };

  return { payments, loading, loadError, reload: load, updatePayment, sendClientReminderNow };
}
