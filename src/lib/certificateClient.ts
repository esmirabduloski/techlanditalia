import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { CourseCertificate } from '@/lib/certificate';

// Reuse the authenticated client; do not change generated types for a pending migration.
type CertificateDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables' | 'Functions'> & {
    Tables: Database['public']['Tables'] & {
      course_certificates: {
        Row: CourseCertificate;
        Insert: Partial<CourseCertificate>;
        Update: Partial<CourseCertificate>;
        Relationships: [];
      };
    };
    Functions: Database['public']['Functions'] & {
      release_group_certificates: {
        Args: { p_group_id: string };
        Returns: CourseCertificate[];
      };
    };
  };
};

export const certificateClient = supabase as unknown as SupabaseClient<CertificateDatabase>;