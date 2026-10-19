/**
 * Percorso del file dentro il bucket a partire da ciò che è salvato nel DB.
 *
 * Oggi si salva il percorso ("<id studente>/foto-123.png"). Le consegne vecchie,
 * di quando il bucket era pubblico, hanno invece l'URL completo
 * ".../storage/v1/object/public/<bucket>/<percorso>": con il bucket privato
 * quell'URL non funziona più, quindi ne ricaviamo il percorso e lo firmiamo.
 * Restituisce null per URL esterni da usare così come sono.
 */
export function storagePathFrom(bucket: string, value: string): string | null {
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, '');
  try {
    const url = new URL(value);
    const marker = new RegExp(`/storage/v1/object/(?:public|sign|authenticated)/${bucket}/(.+)$`);
    const match = url.pathname.match(marker);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}
