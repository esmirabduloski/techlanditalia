import { supabase } from '@/integrations/supabase/client';

export interface MfaUserStatus {
  verifiedFactors: number;
  pendingRequestId: string | null;
  pendingRequestAt: string | null;
  pendingRequestNote: string | null;
}

/** Stato 2FA di tutti gli utenti (solo admin), da public.admin_mfa_overview(). */
export async function fetchMfaOverview(): Promise<Map<string, MfaUserStatus>> {
  const { data, error } = await supabase.rpc('admin_mfa_overview' as never);
  const map = new Map<string, MfaUserStatus>();
  if (error || !Array.isArray(data)) return map;
  for (const row of data as {
    user_id: string;
    verified_factors: number;
    pending_request_id: string | null;
    pending_request_at: string | null;
    pending_request_note: string | null;
  }[]) {
    map.set(row.user_id, {
      verifiedFactors: row.verified_factors,
      pendingRequestId: row.pending_request_id,
      pendingRequestAt: row.pending_request_at,
      pendingRequestNote: row.pending_request_note,
    });
  }
  return map;
}
