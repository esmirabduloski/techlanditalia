import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageCircle, UserCheck, UserPlus, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import type { CrmLead } from '@/hooks/useCRM';

interface Props {
  lead: CrmLead;
  onUpdate: (id: string, patch: Partial<CrmLead>) => Promise<boolean>;
}

/**
 * Secondo genitore nella stessa scheda del lead (migrazione 0077). "Crea account"
 * apre Utenti con il form compilato in modalità "Solo genitore": dopo la
 * creazione propone di collegarlo ai figli dell'account collegato al lead.
 */
export function CRMSecondParent({ lead, onUpdate }: Props) {
  const name = lead.second_parent_name ?? '';
  const email = lead.second_parent_email ?? '';
  const phone = lead.second_parent_phone ?? '';
  const filled = !!(name || email || phone);
  const [adding, setAdding] = useState(false);
  const [account, setAccount] = useState<{ id: string; full_name: string } | null>(null);

  useEffect(() => setAdding(false), [lead.id]);

  // Account del secondo genitore già sulla piattaforma (stessa email)
  useEffect(() => {
    setAccount(null);
    if (!email) return;
    let active = true;
    supabase
      .from('profiles')
      .select('id, full_name')
      .ilike('email', email)
      .eq('role', 'parent')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setAccount(data);
      });
    return () => {
      active = false;
    };
  }, [email]);

  // Colonne assenti: la migrazione 0077 non è ancora applicata
  if (!('second_parent_name' in lead)) return null;

  if (!filled && !adding) {
    return (
      <Button size="sm" variant="outline" className="mb-6" onClick={() => setAdding(true)}>
        <Users className="w-4 h-4 mr-1" /> Aggiungi secondo genitore
      </Button>
    );
  }

  const save = (patch: Partial<CrmLead>) => onUpdate(lead.id, patch);
  const remove = async () => {
    if (await save({ second_parent_name: null, second_parent_email: null, second_parent_phone: null })) setAdding(false);
  };

  const firstName = name.split(' ')[0];
  const waLink = phone
    ? `https://wa.me/${phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(`Ciao ${firstName}, ti scrivo da TECHLAND.`)}`
    : null;
  const createLink = '/admin/utenti?create=1&role=parent_only' +
    `&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}` +
    (lead.linked_profile_id ? `&children_of=${encodeURIComponent(lead.linked_profile_id)}` : '');

  return (
    <div className="space-y-3 mb-6 p-3 border rounded-lg">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Users className="w-4 h-4" /> Secondo genitore
        </Label>
        <Button size="sm" variant="ghost" onClick={remove} title="Togli il secondo genitore">
          <X className="w-4 h-4" />
          <span className="sr-only">Togli il secondo genitore</span>
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`second-name-${lead.id}`} className="text-xs text-muted-foreground">Nome</Label>
          <Input
            id={`second-name-${lead.id}`}
            key={`second-name-${lead.id}`}
            defaultValue={name}
            placeholder="Nome e cognome"
            onBlur={(e) => {
              const v = e.target.value.trim() || null;
              if (v !== (lead.second_parent_name ?? null)) save({ second_parent_name: v });
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`second-phone-${lead.id}`} className="text-xs text-muted-foreground">Telefono</Label>
          <Input
            id={`second-phone-${lead.id}`}
            key={`second-phone-${lead.id}`}
            defaultValue={phone}
            placeholder="+39 ..."
            onBlur={(e) => {
              const v = e.target.value.trim() || null;
              if (v !== (lead.second_parent_phone ?? null)) save({ second_parent_phone: v });
            }}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`second-email-${lead.id}`} className="text-xs text-muted-foreground">Email</Label>
        <Input
          id={`second-email-${lead.id}`}
          key={`second-email-${lead.id}`}
          type="email"
          defaultValue={email}
          onBlur={(e) => {
            const v = e.target.value.trim().toLowerCase() || null;
            if (v !== (lead.second_parent_email ?? null)) save({ second_parent_email: v });
          }}
        />
      </div>
      {(email || waLink) && (
        <div className="flex flex-wrap items-center gap-2">
          {email && (
            <Button size="sm" variant="outline" asChild>
              <a href={`mailto:${email}`}><Mail className="w-4 h-4 mr-1" /> Email</a>
            </Button>
          )}
          {waLink && (
            <Button size="sm" variant="outline" asChild>
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
              </a>
            </Button>
          )}
          {account ? (
            <span className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
              <UserCheck className="w-4 h-4" /> Ha già un account: collegalo ai figli da Utenti → Assegna figli
            </span>
          ) : email && (
            <Button size="sm" variant="secondary" asChild>
              <Link to={createLink}><UserPlus className="w-4 h-4 mr-1" /> Crea account</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
