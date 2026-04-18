import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdminNotifications {
  newBookings: number;
  newContacts: number;
}

export function useAdminNotifications() {
  const [notifications, setNotifications] = useState<AdminNotifications>({
    newBookings: 0,
    newContacts: 0,
  });

  const fetchCounts = async () => {
    const [bookingsResult, contactsResult] = await Promise.all([
      // Conta solo le prenotazioni ancora "in attesa" (non ancora gestite)
      supabase
        .from('trial_bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      // Conta solo i contatti non ancora gestiti (email non inviata)
      supabase
        .from('contact_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('email_sent', false),
    ]);

    setNotifications({
      newBookings: bookingsResult.count || 0,
      newContacts: contactsResult.count || 0,
    });
  };

  useEffect(() => {
    fetchCounts();

    // Subscribe to realtime changes - ricalcola tutto al cambio
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

    return () => {
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(contactsChannel);
    };
  }, []);

  // Manteniamo le funzioni per compatibilità ma ora il conteggio si aggiorna
  // automaticamente quando lo status cambia (es. da pending a contacted)
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
