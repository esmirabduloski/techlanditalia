import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { CourseCertificate, VerifiedCertificate } from '@/lib/certificate';

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
      // 0064_certificate_sharing, in attesa di essere applicata
      set_certificate_public: {
        Args: { p_certificate_id: string; p_public: boolean };
        Returns: CourseCertificate;
      };
      verify_certificate: {
        Args: { p_code: string };
        Returns: VerifiedCertificate[];
      };
    };
  };
};

export const certificateClient = supabase as unknown as SupabaseClient<CertificateDatabase>;