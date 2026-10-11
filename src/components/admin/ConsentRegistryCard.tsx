import { useEffect, useMemo, useState } from 'react';
import { Download, FileCheck2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  consentRecordsToCsv,
  fetchConsentRecords,
  LEGAL_DOCUMENTS,
  type ConsentRecord,
} from '@/lib/legalConsents';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

/**
 * Registro dei consensi a Privacy e Termini: chi ha accettato quale versione,
 * quando e per quale figlio. In sola lettura; esportabile in CSV come prova.
 */
export function ConsentRegistryCard() {
  const [records, setRecords] = useState<ConsentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchConsentRecords()
      .then(setRecords)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!records || !q) return records ?? [];
    return records.filter((r) =>
      [r.accepted_by_name, r.accepted_by_email, r.subject_name].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [records, query]);

  const exportCsv = () => {
    const blob = new Blob(['﻿' + consentRecordsToCsv(filtered)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registro-consensi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileCheck2 className="w-4 h-4" />
            Registro dei consensi
          </CardTitle>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="w-4 h-4 mr-2" />
            Esporta CSV
          </Button>
        </div>
        <CardDescription>
          Accettazioni di Privacy e Termini nell&apos;area riservata. Per i figli (minori di 14 anni) accetta il genitore: una
          riga per figlio, documento e versione, con data, IP e browser. Le righe non si modificano e restano anche se
          l&apos;account viene eliminato.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per genitore, email o figlio"
          aria-label="Cerca nel registro dei consensi"
        />
        {error && <p className="text-sm text-destructive">Registro non disponibile: {error}</p>}
        {!records && !error && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        {records && filtered.length === 0 && <p className="text-sm text-muted-foreground">Nessun consenso registrato.</p>}
        {filtered.length > 0 && (
          <div className="divide-y rounded-lg border text-sm">
            {filtered.slice(0, 200).map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {r.accepted_by_name ?? 'Account eliminato'}
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      {r.capacity === 'self' ? 'per sé' : <>per <strong className="text-foreground">{r.subject_name}</strong></>}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.accepted_by_email} · {fmt(r.accepted_at)}
                    {r.ip ? ` · IP ${r.ip}` : ''}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {LEGAL_DOCUMENTS[r.document]?.label ?? r.document} · v. {r.version}
                </Badge>
              </div>
            ))}
          </div>
        )}
        {filtered.length > 200 && (
          <p className="text-xs text-muted-foreground">Mostrati i 200 più recenti: l&apos;export CSV li contiene tutti.</p>
        )}
      </CardContent>
    </Card>
  );
}
