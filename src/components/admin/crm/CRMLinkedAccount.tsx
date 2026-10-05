import { useEffect, useState } from 'react';
import { Link2, Link2Off, Loader2, Search, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import type { CrmLead } from '@/hooks/useCRM';

interface ProfileOption {
  id: string;
  full_name: string;
  email: string | null;
  username: string | null;
  role: string;
}

interface Props {
  lead: CrmLead;
  onUpdate: (id: string, patch: Partial<CrmLead>) => Promise<boolean>;
}

const ROLE_LABELS: Record<string, string> = { parent: 'Genitore', student: 'Studente' };
const PROFILE_FIELDS = 'id, full_name, email, username, role';

/**
 * Account della piattaforma collegato al lead. Serve per le notifiche push al
 * cliente (promemoria delle rate). Il collegamento automatico avviene per email;
 * qui l'admin può collegarne uno a mano quando le email sono diverse.
 */
export function CRMLinkedAccount({ lead, onUpdate }: Props) {
  const [linked, setLinked] = useState<ProfileOption | null>(null);
  const [loadingLinked, setLoadingLinked] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileOption[] | null>(null);
  const [saving, setSaving] = useState(false);

  // Account collegato
  useEffect(() => {
    if (!lead.linked_profile_id) {
      setLinked(null);
      return;
    }
    let active = true;
    setLoadingLinked(true);
    supabase
      .from('profiles')
      .select(PROFILE_FIELDS)
      .eq('id', lead.linked_profile_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setLinked(data);
        setLoadingLinked(false);
      });
    return () => {
      active = false;
    };
  }, [lead.linked_profile_id]);

  // Quando non è collegato, proponi subito gli account con la stessa email
  useEffect(() => {
    if (lead.linked_profile_id || !lead.email) {
      setResults(null);
      return;
    }
    let active = true;
    supabase
      .from('profiles')
      .select(PROFILE_FIELDS)
      .ilike('email', lead.email)
      .in('role', ['parent', 'student'])
      .limit(5)
      .then(({ data }) => {
        if (active && data && data.length > 0) setResults(data);
      });
    return () => {
      active = false;
    };
  }, [lead.id, lead.linked_profile_id, lead.email]);

  const search = async () => {
    const q = query.trim().replace(/[%,()]/g, '');
    if (q.length < 2) return;
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select(PROFILE_FIELDS)
      .in('role', ['parent', 'student'])
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,username.ilike.%${q}%`)
      .order('role')
      .limit(8);
    setResults(data ?? []);
    setSearching(false);
  };

  const link = async (profileId: string | null) => {
    setSaving(true);
    await onUpdate(lead.id, { linked_profile_id: profileId });
    setSaving(false);
    setResults(null);
    setQuery('');
  };

  if (lead.linked_profile_id) {
    return (
      <div className="mb-6 p-3 bg-green-500/10 rounded-lg text-sm flex items-center gap-2">
        <User className="w-4 h-4 text-green-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium">Account collegato sulla piattaforma</div>
          {loadingLinked ? (
            <span className="text-muted-foreground">Caricamento…</span>
          ) : linked ? (
            <div className="text-muted-foreground truncate">
              {linked.full_name || linked.username}
              {linked.email && ` · ${linked.email}`}
              {ROLE_LABELS[linked.role] && <Badge variant="outline" className="ml-2">{ROLE_LABELS[linked.role]}</Badge>}
            </div>
          ) : (
            <span className="text-muted-foreground">Account non trovato</span>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={() => link(null)} disabled={saving} title="Scollega account">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2Off className="w-4 h-4" />}
          <span className="sr-only">Scollega account</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-6 p-3 rounded-lg border border-dashed text-sm space-y-2">
      <div className="font-medium flex items-center gap-2">
        <Link2 className="w-4 h-4" /> Nessun account collegato
      </div>
      <p className="text-muted-foreground text-xs">
        Collega l'account del genitore per inviargli le notifiche push dei pagamenti.
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="Cerca per nome, email o username…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), search())}
          className="h-9"
          aria-label="Cerca account da collegare"
        />
        <Button size="sm" variant="outline" onClick={search} disabled={searching || query.trim().length < 2}>
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span className="sr-only">Cerca</span>
        </Button>
      </div>
      {results && (
        results.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nessun account trovato.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {results.map(p => (
              <li key={p.id} className="flex items-center gap-2 px-2 py-1.5">
                <div className="flex-1 min-w-0">
                  <div className="truncate">
                    {p.full_name || p.username}
                    {ROLE_LABELS[p.role] && <Badge variant="outline" className="ml-2">{ROLE_LABELS[p.role]}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{p.email ?? (p.username && `@${p.username}`)}</div>
                </div>
                <Button size="sm" onClick={() => link(p.id)} disabled={saving}>Collega</Button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
