/**
 * Escape di una cella CSV con neutralizzazione delle formule (CSV injection):
 * i valori che iniziano con = + - @ tab o CR vengono prefissati con un apice.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let s = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Toglie l'apice messo da csvCell davanti a una formula, quando il file torna indietro. */
export function uncsvCell(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}

/** CSV per Excel in italiano: separatore ";" e righe CRLF. */
export function buildCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Scarica il CSV con il BOM, così Excel lo apre come UTF-8. */
export function downloadCsv(fileName: string, csv: string) {
  downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }), fileName);
}

/**
 * Testo del file caricato: UTF-8 se valido, altrimenti Windows-1252
 * (il "CSV (delimitato)" di Excel su Windows, dove Nicolò diventerebbe Nicol�).
 */
export function decodeCsvBytes(bytes: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** Il separatore più frequente fuori dalle virgolette nella prima riga: ; , o tab. */
function detectSeparator(text: string): string {
  const counts = new Map<string, number>([[";", 0], [",", 0], ["\t", 0]]);
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "\n" || ch === "\r")) break;
    else if (!quoted && counts.has(ch)) counts.set(ch, counts.get(ch)! + 1);
  }
  let best = ";";
  for (const [sep, n] of counts) if (n > counts.get(best)!) best = sep;
  return best;
}

/**
 * CSV secondo RFC 4180: celle tra virgolette con "" e a capo dentro, righe
 * CRLF, LF o CR. Il separatore si riconosce dall'intestazione e il BOM si toglie.
 */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\ufeff/, "");
  const sep = detectSeparator(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else {
        cell += ch;
      }
      i++;
      continue;
    }
    if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\r" || ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else {
      cell += ch;
    }
    i++;
  }
  // L'ultima riga senza a capo finale
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
