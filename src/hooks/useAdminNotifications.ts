import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdminNotifications {
  newBookings: number;
  newContacts: number;
  newCrmLeads: number;
}

export function useAdminNotifications() {
  const [notifications, setNotifications] = useState<AdminNotifications>({
    newBookings: 0,
    newContacts: 0,
    newCrmLeads: 0,
  });

  const fetchCounts = async () => {
    const [bookingsResult, contactsResult, leadsResult] = await Promise.all([
      supabase
        .from('trial_bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('contact_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('email_sent', false),
      // CRM: conta solo i lead ancora nello stage "new" (non ancora gestiti)
      supabase
        .from('crm_leads' as any)
        .select('id', { count: 'exact', head: true })
        .eq('pipeline_stage', 'new'),
    ]);

    setNotifications({
      newBookings: bookingsResult.count || 0,
      newContacts: contactsResult.count || 0,
      newCrmLeads: leadsResult.count || 0,
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

    return () => {
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(contactsChannel);
      supabase.removeChannel(leadsChannel);
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
