/**
 * Colore del bottone "Apri lezioni e compiti" nella home dello studente:
 * ogni corso ha una sua sfumatura di verde, alternando scuri e chiari.
 * Sui verdi scuri il testo è bianco, sui verdi chiari è verde scurissimo (contrasto ≥ 4.5:1).
 * Le classi sono scritte per intero perché Tailwind le trovi; l'hover si attiva su tutta la card (`group`).
 */
export const COURSE_BUTTON_GREENS = [
  'bg-green-700 group-hover:bg-green-800 text-white',
  'bg-lime-400 group-hover:bg-lime-500 text-lime-950',
  'bg-emerald-700 group-hover:bg-emerald-800 text-white',
  'bg-green-300 group-hover:bg-green-400 text-green-950',
  'bg-green-900 group-hover:bg-green-950 text-white',
  'bg-emerald-400 group-hover:bg-emerald-500 text-emerald-950',
  'bg-green-500 group-hover:bg-green-600 text-green-950',
] as const;

/**
 * Sfumatura per posizione nell'elenco dei corsi dello studente:
 * fino a 7 corsi hanno tutti un verde diverso (un colore per id rischierebbe doppioni).
 */
export function courseButtonColor(index: number): string {
  const n = COURSE_BUTTON_GREENS.length;
  return COURSE_BUTTON_GREENS[((Math.trunc(index) % n) + n) % n];
}
