import { cartelleAllegato, nomeNelCodice, type AllegatoGioco } from '@/lib/pgzeroAssets';

/** Admin: come si usano nel gioco Pygame Zero le immagini e i suoni allegati. */
export function PgzeroAssetsHint({ attachments }: { attachments: AllegatoGioco[] }) {
  const usabili = attachments
    .map((a) => ({ a, cartella: cartelleAllegato(a)[0] }))
    .filter((x) => x.cartella);

  return (
    <div className="rounded-md border bg-muted/40 p-3 space-y-2">
      <p className="text-sm font-medium">🎮 Immagini e suoni del gioco</p>
      <p className="text-xs text-muted-foreground">
        Le immagini (PNG, JPG, GIF) e i suoni (WAV, OGG, MP3) allegati diventano file del gioco, insieme a quelli della
        libreria condivisa. Nel codice si usano con il nome del file tutto minuscolo e senza estensione.
      </p>
      {usabili.length > 0 && (
        <ul className="text-xs font-mono space-y-0.5">
          {usabili.map(({ a, cartella }) => {
            const nome = nomeNelCodice(a.name);
            const uso = cartella === 'images' ? `Actor("${nome}")` : cartella === 'fonts' ? `fontname="${nome}"` : `sounds.${nome}.play()`;
            return (
              <li key={a.url}>
                {a.name} → {uso}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
