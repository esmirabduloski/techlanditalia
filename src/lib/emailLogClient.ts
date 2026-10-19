import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { EmailLogRow } from '@/lib/emailCenter';

// Reuse the authenticated client; do not change generated types for a pending migration.
type EmailLogDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Database['public']['Tables'] & {
      email_log: {
        Row: EmailLogRow;
        Insert: Partial<EmailLogRow>;
        Update: Partial<EmailLogRow>;
        Relationships: [];
      };
    };
  };
};

export const emailLogClient = supabase as unknown as SupabaseClient<EmailLogDatabase>;
