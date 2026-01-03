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

  useEffect(() => {
    // Load initial counts from localStorage
    const storedBookings = localStorage.getItem('admin_last_seen_bookings');
    const storedContacts = localStorage.getItem('admin_last_seen_contacts');
    
    const lastSeenBookings = storedBookings ? new Date(storedBookings) : new Date(0);
    const lastSeenContacts = storedContacts ? new Date(storedContacts) : new Date(0);

    // Fetch initial unread counts
    const fetchCounts = async () => {
      const [bookingsResult, contactsResult] = await Promise.all([
        supabase
          .from('trial_bookings')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', lastSeenBookings.toISOString()),
        supabase
          .from('contact_submissions')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', lastSeenContacts.toISOString()),
      ]);

      setNotifications({
        newBookings: bookingsResult.count || 0,
        newContacts: contactsResult.count || 0,
      });
    };

    fetchCounts();

    // Subscribe to realtime changes
    const bookingsChannel = supabase
      .channel('admin-bookings-count')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trial_bookings' },
        () => {
          setNotifications(prev => ({
            ...prev,
            newBookings: prev.newBookings + 1,
          }));
        }
      )
      .subscribe();

    const contactsChannel = supabase
      .channel('admin-contacts-count')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'contact_submissions' },
        () => {
          setNotifications(prev => ({
            ...prev,
            newContacts: prev.newContacts + 1,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(contactsChannel);
    };
  }, []);

  const markBookingsAsSeen = () => {
    localStorage.setItem('admin_last_seen_bookings', new Date().toISOString());
    setNotifications(prev => ({ ...prev, newBookings: 0 }));
  };

  const markContactsAsSeen = () => {
    localStorage.setItem('admin_last_seen_contacts', new Date().toISOString());
    setNotifications(prev => ({ ...prev, newContacts: 0 }));
  };

  return {
    notifications,
    markBookingsAsSeen,
    markContactsAsSeen,
  };
}
