import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdminNotifications {
  newBookings: number;
  newContacts: number;
  newCrmLeads: number;
  /** Pulizie dati (privacy) in attesa di approvazione */
  pendingRetention: number;
}

export function useAdminNotifications() {
  const [notifications, setNotifications] = useState<AdminNotifications>({
    newBookings: 0,
    newContacts: 0,
    newCrmLeads: 0,
    pendingRetention: 0,
  });

  const fetchCounts = async () => {
    const [bookingsResult, contactsResult, leadsResult, retentionResult] = await Promise.all([
      supabase
        .from('trial_bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('contact_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('email_sent', false),
      // CRM: conta solo i lead ancora nello stage "new" e non nel cestino
      supabase
        .from('crm_leads' as any)
        .select('id', { count: 'exact', head: true })
        .eq('pipeline_stage', 'new')
        .is('deleted_at', null),
      // Tabella non ancora nei tipi generati da Lovable (vedi migration data_retention_runs)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.from('data_retention_runs' as any)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ]);

    setNotifications({
      newBookings: bookingsResult.count || 0,
      newContacts: contactsResult.count || 0,
      newCrmLeads: leadsResult.count || 0,
      pendingRetention: retentionResult.count || 0,
    });
  };

  useEffect(() => {
    fetchCounts();

    const bookingsChannel = supabase
      .channel('admin-bookings-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trial_bookings' },
        () => fetchCounts()
      )
      .subscribe();

    const contactsChannel = supabase
      .channel('admin-contacts-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contact_submissions' },
        () => fetchCounts()
      )
      .subscribe();

    const leadsChannel = supabase
      .channel('admin-crm-leads-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_leads' },
        () => fetchCounts()
      )
      .subscribe();

    const retentionChannel = supabase
      .channel('admin-retention-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'data_retention_runs' },
        () => fetchCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(contactsChannel);
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(retentionChannel);
    };
  }, []);

  const markBookingsAsSeen = () => {
    fetchCounts();
  };

  const markContactsAsSeen = () => {
    fetchCounts();
  };

  return {
    notifications,
    markBookingsAsSeen,
    markContactsAsSeen,
  };
}
