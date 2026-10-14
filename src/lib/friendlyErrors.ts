// Spiega in italiano semplice gli errori di Python (Pyodide e Skulpt).
// "NameError: name 'x' is not defined" diventa "Hai usato `x`, ma Python
// non sa ancora cos'è". I nomi del codice sono tra backtick: il componente
// FriendlyError li mostra come codice.

export interface FriendlyError {
  // Tipo Python originale (NameError, SyntaxError, ...); null se non riconosciuto
  type: string | null;
  title: string;
  explanation: string;
  tip?: string;
  line?: number;
  // Ultima riga del messaggio in inglese, per chi vuole impararlo
  original: string;
}

const BUILTINS = [
  'print', 'input', 'int', 'float', 'str', 'len', 'range', 'list', 'dict', 'set', 'tuple', 'bool',
  'abs', 'min', 'max', 'sum', 'round', 'sorted', 'reversed', 'enumerate', 'zip', 'type', 'True',
  'False', 'None', 'import', 'from', 'def', 'return', 'while', 'for', 'if', 'elif', 'else', 'break',
  'continue', 'random', 'randint', 'choice', 'turtle', 'forward', 'backward', 'left', 'right',
  'penup', 'pendown', 'color', 'circle', 'goto', 'speed', 'shape', 'append', 'split', 'upper',
  'lower', 'strip', 'replace', 'join', 'keys', 'values', 'items', 'pop', 'insert', 'remove',
];

const TYPE_NAMES: Record<string, string> = {
  str: 'testo', int: 'numero intero', float: 'numero con la virgola', list: 'lista',
  dict: 'dizionario', tuple: 'tupla', bool: 'vero/falso', NoneType: 'None (niente)',
  set: 'insieme', function: 'funzione', module: 'modulo',
};
const typeName = (t: string) => TYPE_NAMES[t] ?? `\`${t}\``;

// Distanza tra due parole; due lettere scambiate (pritn/print) contano come un solo errore
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// Il nome scritto bene più vicino a quello sbagliato (Print -> print, pritn -> print)
export function closestName(name: string, code = ''): string | null {
  const known = new Set([...BUILTINS, ...(code.match(/[A-Za-z_]\w*/g) ?? [])]);
  known.delete(name);
  let best: string | null = null;
  let bestD = Infinity;
  for (const k of known) {
    if (k.toLowerCase() === name.toLowerCase()) return k;
    const d = distance(name.toLowerCase(), k.toLowerCase());
    if (d < bestD) { best = k; bestD = d; }
  }
  const max = name.length <= 5 ? 1 : 2;
  return bestD <= max ? best : null;
}

// Riga dell'errore: "(riga 3)" dal worker, "on line 3" da Skulpt, File "<exec>", line 3 da Pyodide
function findLine(raw: string): number | undefined {
  const own = raw.match(/\(riga (\d+)\)\s*$/) ?? raw.match(/ on line (\d+)\s*$/);
  if (own) return Number(own[1]);
  const re = /File "<(?:exec|stdin)>", line (\d+)/g;
  let m: RegExpExecArray | null;
  let last: number | undefined;
  while ((m = re.exec(raw))) last = Number(m[1]);
  return last;
}

function lastLine(raw: string): string {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  return (lines[lines.length - 1] ?? raw.trim())
    .replace(/\s*\(riga \d+\)$/, '')
    .replace(/ on line \d+$/, '');
}

type Explained = Omit<FriendlyError, 'type' | 'line' | 'original'>;

function explainSyntax(msg: string): Explained {
  const title = 'Python non capisce come è scritta una riga';
  let m: RegExpMatchArray | null;
  if ((m = msg.match(/'([([{])' was never closed/)))
    return { title, explanation: `Hai aperto una parentesi \`${m[1]}\` ma non l'hai mai chiusa.`, tip: 'Ogni parentesi aperta deve avere la sua parentesi chiusa. Contale!' };
  if ((m = msg.match(/unmatched '([)\]}])'/)))
    return { title, explanation: `C'è una parentesi \`${m[1]}\` chiusa in più, che non era mai stata aperta.` };
  if ((m = msg.match(/closing parenthesis '(.)' does not match opening parenthesis '(.)'/)))
    return { title, explanation: `Hai aperto con \`${m[2]}\` ma chiuso con \`${m[1]}\`: le parentesi devono essere dello stesso tipo.` };
  if (/unterminated (triple-quoted )?string|EOL while scanning string|EOF while scanning/.test(msg))
    return { title, explanation: 'Un testo è iniziato con le virgolette ma non è mai finito.', tip: 'Il testo va chiuso con le stesse virgolette con cui l\'hai aperto: "ciao" oppure \'ciao\'.' };
  if (/expected ':'/.test(msg))
    return { title, explanation: 'Mancano i due punti `:` alla fine della riga.', tip: 'Dopo `if`, `elif`, `else`, `for`, `while` e `def` servono sempre i due punti.' };
  if (/Perhaps you forgot a comma/.test(msg))
    return { title, explanation: 'Sembra che manchi una virgola tra due cose.', tip: 'Tra i valori dentro `print(...)` o in una lista ci vuole una virgola: `print("Ciao", nome)`.' };
  if (/Maybe you meant '==' /.test(msg) || /cannot assign to (comparison|expression)/.test(msg))
    return { title, explanation: 'Hai usato `=` dove serviva un confronto.', tip: '`=` mette un valore in una variabile, `==` controlla se due cose sono uguali.' };
  if ((m = msg.match(/Missing parentheses in call to '(\w+)'/)))
    return { title, explanation: `Mancano le parentesi dopo \`${m[1]}\`.`, tip: `Si scrive \`${m[1]}("...")\`, con le parentesi tonde.` };
  if (/invalid character '[“”‘’]'/.test(msg))
    return { title, explanation: 'Hai usato delle virgolette “curve” che Python non conosce.', tip: 'Usa le virgolette dritte della tastiera: " oppure \'. Succede spesso quando si copia il codice da un documento.' };
  if ((m = msg.match(/invalid character '(.)'/)))
    return { title, explanation: `Il simbolo \`${m[1]}\` non si può usare nel codice Python.` };
  if (/incomplete input|unexpected EOF/.test(msg))
    return { title, explanation: 'Il programma finisce all\'improvviso, come una frase lasciata a metà.', tip: 'Controlla che tutte le parentesi e le virgolette siano chiuse.' };
  if (/invalid decimal literal/.test(msg))
    return { title, explanation: 'Un nome non può iniziare con un numero.', tip: 'Scrivi `giocatore1` invece di `1giocatore`.' };
  if (/'return' outside function/.test(msg))
    return { title, explanation: '`return` si può usare solo dentro una funzione (`def`).' };
  if (/'break' outside loop|'continue' not properly in loop/.test(msg))
    return { title, explanation: '`break` e `continue` si possono usare solo dentro un ciclo `for` o `while`.' };
  return { title, explanation: 'C\'è qualcosa di scritto male in questa riga, per esempio una parentesi, delle virgolette o i due punti.', tip: 'Guarda bene la riga indicata e anche quella prima.' };
}

function explainIndentation(msg: string): Explained {
  const title = 'Gli spazi all\'inizio della riga non tornano';
  let m: RegExpMatchArray | null;
  if ((m = msg.match(/expected an indented block(?: after '?(\w+)'? statement)?/)))
    return { title, explanation: `Dopo ${m[1] ? `\`${m[1]}\` ` : 'i due punti `:` '}la riga successiva deve essere spostata a destra.`, tip: 'Premi Tab (o 4 spazi) all\'inizio delle righe che stanno "dentro" il blocco.' };
  if (/unexpected indent/.test(msg))
    return { title, explanation: 'Questa riga è spostata a destra ma non dovrebbe esserlo.', tip: 'Togli gli spazi all\'inizio della riga, oppure controlla che la riga sopra finisca con `:`.' };
  if (/unindent does not match|inconsistent use of tabs/.test(msg))
    return { title, explanation: 'Questa riga non è allineata con le righe sopra.', tip: 'Le righe dello stesso blocco devono iniziare tutte alla stessa distanza dal bordo.' };
  return { title, explanation: 'Gli spazi all\'inizio della riga non sono giusti.', tip: 'In Python gli spazi all\'inizio della riga sono importanti: indicano cosa sta dentro `if`, `for`, `def`...' };
}

function explainType(msg: string): Explained {
  let m: RegExpMatchArray | null;
  if ((m = msg.match(/can only concatenate str \(not "(\w+)"\) to str/)) || (m = msg.match(/cannot concatenate 'str' and '(\w+)'/)))
    return { title: 'Stai unendo testo e numeri', explanation: `Con \`+\` hai provato ad attaccare un ${typeName(m[1])} a un testo.`, tip: 'Trasforma il numero in testo con `str(numero)`, oppure separa con la virgola: `print("Punti:", punti)`.' };
  if ((m = msg.match(/unsupported operand type\(s\) for (.+?): '(\w+)' and '(\w+)'/))) {
    const hasStr = m[2] === 'str' || m[3] === 'str';
    return {
      title: 'Stai facendo un calcolo con cose diverse',
      explanation: `Non si può fare \`${m[1]}\` tra un ${typeName(m[2])} e un ${typeName(m[3])}.`,
      tip: hasStr ? '`input()` restituisce sempre testo: per avere un numero scrivi `int(input())`.' : undefined,
    };
  }
  if ((m = msg.match(/can't multiply sequence by non-int of type '(\w+)'/)))
    return { title: 'Stai moltiplicando un testo', explanation: `Un testo si può moltiplicare solo per un numero intero, non per un ${typeName(m[1])}.`, tip: 'Se volevi fare un calcolo, trasforma il testo in numero con `int(...)` o `float(...)`.' };
  if ((m = msg.match(/'([<>]=?)' not supported between instances of '(\w+)' and '(\w+)'/)))
    return { title: 'Stai confrontando cose diverse', explanation: `Non si può usare \`${m[1]}\` tra un ${typeName(m[2])} e un ${typeName(m[3])}.`, tip: '`input()` restituisce testo: usa `int(input())` se ti serve un numero.' };
  if ((m = msg.match(/(\w+)\(\) missing (\d+) required positional arguments?: (.+)/)))
    return { title: 'Mancano dei valori nella funzione', explanation: `Hai chiamato \`${m[1]}()\` senza dargli tutto quello che le serve: manca ${m[3].replace(/'/g, '`')}.`, tip: 'Metti tra le parentesi tanti valori quanti ne chiede la funzione.' };
  if ((m = msg.match(/(\w+)\(\) takes (\d+) positional arguments? but (\d+) (?:was|were) given/)))
    return { title: 'Troppi valori nella funzione', explanation: `\`${m[1]}()\` vuole ${m[2]} valor${m[2] === '1' ? 'e' : 'i'}, ma gliene hai dati ${m[3]}.` };
  if ((m = msg.match(/'(\w+)' object is not callable/)))
    return { title: 'Questa non è una funzione', explanation: `Hai messo le parentesi \`()\` dopo un ${typeName(m[1])}, come se fosse una funzione.`, tip: 'Forse hai dato a una variabile lo stesso nome di una funzione (per esempio `print = 5`)?' };
  if ((m = msg.match(/'(\w+)' object is not subscriptable/)))
    return { title: 'Qui non si possono usare le parentesi quadre', explanation: `Hai usato \`[ ]\` su un ${typeName(m[1])}: si usano solo con liste, testi e dizionari.` };
  if ((m = msg.match(/'(\w+)' object is not iterable/)))
    return { title: 'Non si può fare un ciclo su questo', explanation: `\`for\` può scorrere una lista o un testo, non un ${typeName(m[1])}.`, tip: 'Per ripetere un numero di volte usa `for i in range(numero):`.' };
  if ((m = msg.match(/object of type '(\w+)' has no len\(\)/)))
    return { title: 'Non si può misurare', explanation: `\`len()\` funziona con testi e liste, non con un ${typeName(m[1])}.` };
  if ((m = msg.match(/'(\w+)' object does not support item assignment/)))
    return { title: 'Non si può cambiare un pezzo', explanation: `Un ${typeName(m[1])} non si può modificare un pezzo alla volta.`, tip: m[1] === 'str' ? 'Crea un testo nuovo, per esempio con `.replace(...)`.' : undefined };
  return { title: 'Stai usando un tipo di valore sbagliato', explanation: 'Hai usato un valore (testo, numero, lista...) in un modo che non funziona per quel tipo.' };
}

function explainKnown(type: string, msg: string, code: string): Explained {
  let m: RegExpMatchArray | null;
  switch (type) {
    case 'SyntaxError':
      return explainSyntax(msg);
    case 'IndentationError':
    case 'TabError':
      return explainIndentation(msg);
    case 'NameError': {
      const name = msg.match(/name '(\w+)' is not defined/)?.[1];
      if (!name) break;
      const close = closestName(name, code);
      return {
        title: 'Hai usato un nome che Python non conosce',
        explanation: `Hai usato \`${name}\`, ma Python non sa ancora cos'è.`,
        tip: close
          ? `Forse volevi scrivere \`${close}\`? Attenzione a maiuscole e minuscole.`
          : `Se è una variabile, dalle un valore prima di usarla (es. \`${name} = 0\`). Se è un testo, mettilo tra virgolette: \`"${name}"\`.`,
      };
    }
    case 'UnboundLocalError': {
      const name = msg.match(/variable '(\w+)'/)?.[1] ?? '';
      return {
        title: 'Variabile usata prima di avere un valore',
        explanation: `Dentro la funzione usi \`${name}\` prima di averle dato un valore.`,
        tip: `Se \`${name}\` è una variabile di fuori, scrivi \`global ${name}\` all'inizio della funzione.`,
      };
    }
    case 'TypeError':
      return explainType(msg);
    case 'ValueError':
      if ((m = msg.match(/invalid literal for int\(\) with base \d+: (.+)/)))
        return { title: 'Questo testo non è un numero', explanation: `\`int()\` non riesce a trasformare ${m[1]} in un numero intero.`, tip: 'Controlla di scrivere solo cifre, senza lettere, spazi o virgola (per i decimali usa `float()` e il punto: `3.5`).' };
      if ((m = msg.match(/could not convert string to float: (.+)/)))
        return { title: 'Questo testo non è un numero', explanation: `\`float()\` non riesce a trasformare ${m[1]} in un numero.`, tip: 'Per i decimali si usa il punto, non la virgola: `3.5`.' };
      if (/too many values to unpack|not enough values to unpack/.test(msg))
        return { title: 'Il numero di variabili non torna', explanation: 'A sinistra dell\'`=` ci sono più (o meno) variabili dei valori a destra.' };
      if (/empty range|empty sequence/.test(msg) || (m = msg.match(/(max|min)\(\) arg is an empty sequence/)))
        return { title: 'La lista è vuota', explanation: 'Hai chiesto di scegliere da una lista che non contiene niente.' };
      return { title: 'Valore non adatto', explanation: 'Il tipo è giusto, ma il valore non va bene per questa operazione.' };
    case 'ZeroDivisionError':
      return { title: 'Divisione per zero', explanation: 'Hai provato a dividere per zero: non si può fare, nemmeno in matematica!', tip: 'Controlla che il numero sotto la divisione non sia 0, magari con un `if`.' };
    case 'IndexError':
      return {
        title: 'Posizione che non esiste',
        explanation: `Hai chiesto un elemento in una posizione che ${/string/.test(msg) ? 'il testo' : 'la lista'} non ha.`,
        tip: 'Le posizioni partono da 0: in una lista di 3 elementi l\'ultimo è alla posizione 2.',
      };
    case 'KeyError':
      return { title: 'Chiave non trovata', explanation: `Nel dizionario non c'è la chiave ${msg.trim() || 'che hai chiesto'}.`, tip: 'Controlla come è scritta (maiuscole comprese) oppure usa `.get(...)`.' };
    case 'AttributeError': {
      m = msg.match(/(?:'(\w+)' object|module '(\w+)') has no attribute '(\w+)'/);
      if (!m) break;
      const owner = m[1] ? `un ${typeName(m[1])}` : `il modulo \`${m[2]}\``;
      const close = closestName(m[3], code);
      return {
        title: 'Comando che non esiste',
        explanation: `${owner[0].toUpperCase()}${owner.slice(1)} non ha nessun comando \`${m[3]}\`.`,
        tip: close ? `Forse volevi scrivere \`${close}\`?` : 'Controlla come è scritto il nome dopo il punto.',
      };
    }
    case 'ModuleNotFoundError':
    case 'ImportError': {
      const name = msg.match(/No module named '?([\w.]+)'?/)?.[1];
      return { title: 'Modulo non trovato', explanation: name ? `Python non trova nessun modulo chiamato \`${name}\`.` : 'Python non riesce a importare quello che hai chiesto.', tip: 'Controlla come è scritto il nome dopo `import`.' };
    }
    case 'RecursionError':
      return { title: 'Funzione che chiama se stessa all\'infinito', explanation: 'Una funzione continua a chiamare se stessa e non si ferma mai.', tip: 'Serve un caso in cui la funzione si ferma senza richiamarsi.' };
    case 'EOFError':
      return { title: 'Mancano dati in input', explanation: msg && !/EOF when reading/.test(msg) ? msg : 'Il programma ha chiesto un `input()` ma non c\'era niente da leggere.' };
    case 'KeyboardInterrupt':
      return { title: 'Programma interrotto', explanation: 'Hai annullato la finestra dell\'input, quindi il programma si è fermato.' };
    case 'OverflowError':
      return { title: 'Numero troppo grande', explanation: 'Il risultato è un numero troppo grande da gestire.' };
    case 'MemoryError':
      return { title: 'Memoria finita', explanation: 'Il programma ha usato troppa memoria, forse una lista che cresce senza fine.' };
    case 'Terminator':
      return { title: 'Disegno interrotto', explanation: 'La finestra della tartaruga è stata chiusa mentre il programma disegnava.' };
  }
  return { title: 'C\'è un errore nel programma', explanation: 'Python si è fermato per un errore.', tip: 'Leggi il messaggio originale qui sotto e guarda la riga indicata.' };
}

export function explainPythonError(raw: string, code = ''): FriendlyError | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const original = lastLine(text);
  const line = findLine(text);
  const m = original.match(/^(?:[\w.]+\.)?([A-Z]\w*(?:Error|Exception|Interrupt|Terminator))\s*(?::\s*(.*))?$/);
  if (!m) return null;
  const type = m[1];
  return { type, line, original, ...explainKnown(type, m[2] ?? '', code) };
}
