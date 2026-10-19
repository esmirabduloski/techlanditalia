import { test, expect } from "../support/test";
import { eseguiPython, esitoCasiDiProva, impostaCodice, preparaAlunno, rispondiAiPrompt, taskUrl } from "./apri";

/**
 * Compilatore Python (Pyodide vero, la stessa versione del sito): i programmi
 * tipici dei corsi devono dare esattamente lo stesso output dopo ogni
 * aggiornamento di Pyodide o del compilatore. I casi girano tutti nella stessa
 * pagina per scaricare Pyodide una volta sola.
 */

const CASI: { nome: string; codice: string; output: string }[] = [
  {
    nome: "print con sep/end, accenti ed emoji",
    codice: 'print("Ciao", "mondo", sep=", ", end="!\\n")\nprint("perché è così 🐍")\nprint(1, 2.5, True, None)',
    output: "Ciao, mondo!\nperché è così 🐍\n1 2.5 True None\n",
  },
  {
    nome: "calcoli e f-string",
    codice: [
      "a, b = 17, 5",
      "print(a // b, a % b, a ** 2, a / b)",
      "print(round(3.14159, 2), round(2.5), abs(-4), max(3, 9, 1), min([4, 2]))",
      'print(f"{a} diviso {b} fa {a / b:.1f}")',
      'print(int("42") + float("0.5"), str(7) + "7")',
    ].join("\n"),
    output: "3 2 289 3.4\n3.14 2 4 9 2\n17 diviso 5 fa 3.4\n42.5 77\n",
  },
  {
    nome: "stringhe",
    codice: [
      'nome = "Techland Italia"',
      "print(nome.upper(), nome.lower(), len(nome))",
      "print(nome[0], nome[-1], nome[0:8], nome[::-1])",
      'print(nome.split(), "-".join(["a", "b", "c"]))',
      'print(nome.replace("Italia", "Roma"), nome.count("a"), "land" in nome)',
      'print("  spazi  ".strip() + "|", "abc".center(7, "*"), "x".zfill(3))',
    ].join("\n"),
    output: "TECHLAND ITALIA techland italia 15\nT a Techland ailatI dnalhceT\n['Techland', 'Italia'] a-b-c\nTechland Roma 3 True\nspazi| **abc** 00x\n",
  },
  {
    nome: "liste, dizionari, tuple e set",
    codice: [
      "numeri = [5, 3, 8, 1]",
      "numeri.append(10)",
      "numeri.sort()",
      "print(numeri, sum(numeri), len(numeri))",
      "print([n * n for n in range(1, 6) if n % 2 == 1])",
      'voti = {"Luca": 8, "Sara": 9}',
      'voti["Marco"] = 7',
      "for nome, voto in voti.items():",
      "    print(nome, voto)",
      'print(sorted(voti, key=voti.get), voti.get("Anna", 0))',
      "x, y = (3, 4)",
      'print(x + y, set([1, 2, 2, 3]) | {4}, list(zip("ab", [1, 2])))',
      'print(list(enumerate(["a", "b"], start=1)))',
    ].join("\n"),
    output: "[1, 3, 5, 8, 10] 27 5\n[1, 9, 25]\nLuca 8\nSara 9\nMarco 7\n['Marco', 'Luca', 'Sara'] 0\n7 {1, 2, 3, 4} [('a', 1), ('b', 2)]\n[(1, 'a'), (2, 'b')]\n",
  },
  {
    nome: "cicli for/while con break e continue",
    codice: [
      "for i in range(3):",
      '    print("giro", i)',
      "n = 0",
      "while True:",
      "    n += 1",
      "    if n == 2:",
      "        continue",
      "    if n > 4:",
      "        break",
      '    print("n =", n)',
      "for riga in range(1, 4):",
      '    print("*" * riga)',
      "else:",
      '    print("fine")',
    ].join("\n"),
    output: "giro 0\ngiro 1\ngiro 2\nn = 1\nn = 3\nn = 4\n*\n**\n***\nfine\n",
  },
  {
    nome: "funzioni e classi",
    codice: [
      'def saluta(nome, saluto="Ciao"):',
      '    return f"{saluto}, {nome}!"',
      "",
      "def conta(*numeri):",
      "    return len(numeri)",
      "",
      "class Animale:",
      "    def __init__(self, nome, verso):",
      "        self.nome = nome",
      "        self.verso = verso",
      "    def parla(self):",
      '        return f"{self.nome} fa {self.verso}"',
      "    def __str__(self):",
      '        return f"Animale({self.nome})"',
      "",
      "class Cane(Animale):",
      "    def __init__(self, nome):",
      '        super().__init__(nome, "bau")',
      "",
      'print(saluta("Luca"), saluta("Sara", saluto="Buongiorno"))',
      "print(conta(1, 2, 3), (lambda x: x * 2)(21))",
      'fido = Cane("Fido")',
      "print(fido.parla(), fido, isinstance(fido, Animale))",
    ].join("\n"),
    output: "Ciao, Luca! Buongiorno, Sara!\n3 42\nFido fa bau Animale(Fido) True\n",
  },
  {
    nome: "try/except/finally",
    codice: [
      'for valore in ["12", "ciao"]:',
      "    try:",
      "        print(int(valore) * 2)",
      "    except ValueError:",
      '        print("non è un numero:", valore)',
      "    finally:",
      '        print("controllato")',
      "try:",
      '    raise RuntimeError("guasto")',
      "except Exception as e:",
      "    print(type(e).__name__, e)",
    ].join("\n"),
    output: "24\ncontrollato\nnon è un numero: ciao\ncontrollato\nRuntimeError guasto\n",
  },
  {
    nome: "moduli math, random, time, datetime, collections",
    codice: [
      "import math, random, time, datetime",
      "from collections import Counter",
      "print(math.sqrt(16), math.pi > 3.14, math.floor(2.7), math.ceil(2.1))",
      "random.seed(42)",
      "dadi = [random.randint(1, 6) for _ in range(5)]",
      "print(all(1 <= d <= 6 for d in dadi), len(dadi))",
      "random.seed(42)",
      'print(dadi == [random.randint(1, 6) for _ in range(5)], random.choice(["sasso"]))',
      "inizio = time.time()",
      "time.sleep(0.2)",
      "print(time.time() - inizio >= 0.15)",
      'oggi = datetime.date(2026, 10, 19)',
      'print(oggi.strftime("%d/%m/%Y"), oggi.weekday(), (oggi + datetime.timedelta(days=13)).isoformat())',
      'print(Counter("banana").most_common(1))',
    ].join("\n"),
    output: "4.0 True 2 3\nTrue 5\nTrue sasso\nTrue\n19/10/2026 0 2026-11-01\n[('a', 3)]\n",
  },
];

const ERRORI: { nome: string; codice: string; titolo: string; output?: string }[] = [
  { nome: "NameError", codice: 'print("prima")\nprint(punteggio)', titolo: "Hai usato un nome che Python non conosce · riga 2", output: "prima\n" },
  { nome: "ZeroDivisionError", codice: "a = 5\nprint(a / 0)", titolo: "Divisione per zero · riga 2" },
  // Python indica la riga dell'if ("expected an indented block after 'if' statement on line 1")
  { nome: "IndentationError", codice: 'if True:\nprint("ciao")', titolo: "Gli spazi all'inizio della riga non tornano · riga 1" },
  { nome: "SyntaxError (mancano i due punti)", codice: "for i in range(3)\n    print(i)", titolo: "Python non capisce come è scritta una riga · riga 1" },
  { nome: "TypeError (testo + numero)", codice: 'eta = 10\nprint("Hai " + eta + " anni")', titolo: "Stai unendo testo e numeri · riga 2" },
  { nome: "IndexError", codice: "lista = [1, 2, 3]\nprint(lista[3])", titolo: "Posizione che non esiste · riga 2" },
  { nome: "ValueError (int)", codice: 'numero = int("ciao")', titolo: "Questo testo non è un numero · riga 1" },
  { nome: "KeyError", codice: 'voti = {"Luca": 8}\nprint(voti["Sara"])', titolo: "Chiave non trovata · riga 2" },
  { nome: "ModuleNotFoundError", codice: "import modulo_che_non_esiste", titolo: "Modulo non trovato · riga 1" },
  { nome: "RecursionError", codice: "def giu(n):\n    return giu(n + 1)\n\ngiu(0)", titolo: "Funzione che chiama se stessa all'infinito · riga 2" },
];

test.beforeEach(async ({ fake, page }) => {
  await preparaAlunno(page, fake, "python-base", { default_python_code: "# scrivi qui\n" });
});

async function apriEditor(page: import("@playwright/test").Page) {
  await page.goto(taskUrl);
  await expect(page.getByRole("button", { name: "Esegui" })).toBeEnabled({ timeout: 90_000 });
  return page.getByPlaceholder("Scrivi il tuo codice Python...");
}

test("Esegui: i programmi tipici dei corsi danno l'output atteso", async ({ page }) => {
  test.slow(); // primo download di Pyodide
  const editor = await apriEditor(page);

  for (const caso of CASI) {
    await test.step(caso.nome, async () => {
      await editor.fill(caso.codice);
      const esito = await eseguiPython(page);
      expect.soft(esito.errore, caso.nome).toBeNull();
      expect.soft(esito.output, caso.nome).toBe(caso.output);
    });
  }
});

test("Esegui: gli errori arrivano spiegati in italiano con la riga giusta", async ({ page }) => {
  test.slow();
  const editor = await apriEditor(page);

  for (const caso of ERRORI) {
    await test.step(caso.nome, async () => {
      await editor.fill(caso.codice);
      const esito = await eseguiPython(page);
      expect.soft(esito.errore ?? `nessun errore spiegato, output: ${esito.output}`, caso.nome).toContain(caso.titolo);
      if (caso.output !== undefined) expect.soft(esito.output, caso.nome).toBe(caso.output);
    });
  }
});

test("Esegui: input() chiede con una finestra e riporta le risposte nell'output", async ({ page }) => {
  test.slow();
  const editor = await apriEditor(page);

  await editor.fill('nome = input("Come ti chiami? ")\neta = int(input("Quanti anni hai? "))\nprint(f"Ciao {nome}, tra un anno avrai {eta + 1} anni")');
  const prompt = rispondiAiPrompt(page, ["Luca", "11"]);
  const esito = await eseguiPython(page);
  prompt.stop();
  expect(esito.errore).toBeNull();
  expect(esito.output).toBe("Come ti chiami? Luca\nQuanti anni hai? 11\nCiao Luca, tra un anno avrai 12 anni\n");
  // La seconda domanda mostra anche quello che il programma ha già scritto
  expect(prompt.messaggi).toEqual(["Come ti chiami? ", "Come ti chiami? Luca\nQuanti anni hai? "]);

  // "Annulla" ferma il programma con un messaggio chiaro
  await editor.fill('print("inizio")\nx = input("Numero? ")\nprint("mai")');
  const annulla = rispondiAiPrompt(page, [null]);
  const interrotto = await eseguiPython(page);
  annulla.stop();
  expect(interrotto.errore).toContain("Programma interrotto");
  expect(interrotto.output).not.toContain("mai");
});

test("Verifica: i casi di prova io e assert passano con la soluzione", async ({ page, fake }) => {
  test.slow(); // Pyodide anche nel worker dei casi di prova
  impostaCodice(fake, {
    default_python_code: "# scrivi qui\n",
    test_cases: [
      { id: "doppio", name: "Raddoppia il numero letto", kind: "io", stdin: "21\n", expected: "42", match: "trim" },
      { id: "saluto", name: "Saluta per nome", kind: "io", stdin: "Sara\n", expected: "Sara", match: "contains" },
      { id: "esatto", name: "Output esatto", kind: "io", stdin: "1\n", expected: "2\n", match: "exact" },
      // Prima dell'assert gira il programma dello studente, che chiede un input
      { id: "funzione", name: "La funzione doppio", kind: "assert", stdin: "4\n", code: "assert doppio(5) == 10\nassert doppio(-1) == -2" },
    ],
  });
  await page.goto(taskUrl);
  const panel = page.getByTestId("test-cases-panel");
  const verifica = page.getByRole("button", { name: "Verifica" }).first();

  // Con il codice di partenza non passa niente
  await verifica.click();
  await expect(panel.getByText("0/4 test superati")).toBeVisible({ timeout: 90_000 });
  expect(await esitoCasiDiProva(page)).toBe("✗✗✗✗");

  await page.getByPlaceholder("Scrivi il tuo codice Python...").fill([
    "def doppio(n):",
    "    return n * 2",
    "",
    'valore = input("Scrivi un numero: ")',
    "if valore.isdigit():",
    "    print(doppio(int(valore)))",
    "else:",
    '    print("Ciao", valore)',
  ].join("\n"));
  await verifica.click();
  await expect(panel.getByText("4/4 test superati")).toBeVisible({ timeout: 30_000 });
  expect(await esitoCasiDiProva(page)).toBe("✓✓✓✓");
});
