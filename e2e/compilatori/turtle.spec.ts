import type { Page } from "@playwright/test";
import { test, expect } from "../support/test";
import { compitoUrl, eseguiTurtle, impostaCodice, preparaAlunno, rispondiAiPrompt, taskUrl } from "./apri";
import { colore, leggiDisegno, pixelDisegnati, vicino, type Disegno } from "./disegno";

/**
 * Compilatore Turtle (Skulpt vero, la stessa versione del sito): i disegni
 * tipici dei corsi devono uscire uguali dopo ogni aggiornamento. Si controlla
 * il colore di punti precisi del disegno (in coordinate della tartaruga:
 * (0, 0) al centro, y verso l'alto), che non dipende dai font del sistema.
 */

const RGB: Record<string, [number, number, number]> = {
  white: [255, 255, 255],
  red: [255, 0, 0],
  blue: [0, 0, 255],
  green: [0, 128, 0],
  purple: [128, 0, 128],
  orange: [255, 165, 0],
  yellow: [255, 255, 0],
};

type Punto = [x: number, y: number];

interface Caso {
  nome: string;
  codice: string;
  /** Punti che devono avere questo colore */
  colori?: [Punto, keyof typeof RGB][];
  /** Punti che devono restare dello sfondo */
  vuoti?: Punto[];
  /** Pixel disegnati almeno questi, nel rettangolo [x1, y1, x2, y2] (tutta l'area se manca) */
  disegnati?: { minimo: number; zona?: [number, number, number, number] };
  output?: string;
}

const CASI: Caso[] = [
  {
    nome: "quadrato blu",
    codice: 'import turtle\nt = turtle.Turtle()\nt.color("blue")\nt.pensize(5)\nt.speed(0)\nfor _ in range(4):\n    t.forward(100)\n    t.right(90)\nt.hideturtle()\nturtle.done()',
    colori: [[[50, 0], "blue"], [[100, -50], "blue"], [[50, -100], "blue"], [[0, -50], "blue"]],
    vuoti: [[50, -50], [150, 0]],
  },
  {
    nome: "quadrato pieno rosso (begin_fill/end_fill)",
    codice: 'import turtle\nt = turtle.Turtle()\nt.speed(0)\nt.color("red")\nt.begin_fill()\nfor _ in range(4):\n    t.forward(100)\n    t.left(90)\nt.end_fill()\nt.hideturtle()',
    colori: [[[50, 50], "red"], [[20, 80], "red"]],
    vuoti: [[50, -50], [150, 50]],
  },
  {
    nome: "cerchio pieno verde",
    codice: 'import turtle\nt = turtle.Turtle()\nt.speed(0)\nt.color("green")\nt.begin_fill()\nt.circle(50)\nt.end_fill()\nt.hideturtle()',
    colori: [[[0, 50], "green"], [[30, 50], "green"]],
    vuoti: [[0, 130], [80, 50]],
  },
  {
    nome: "penup e goto non lasciano il segno",
    codice: 'import turtle\nt = turtle.Turtle()\nt.speed(0)\nt.penup()\nt.goto(-200, 100)\nt.pendown()\nt.pensize(5)\nt.color("purple")\nt.forward(100)\nt.hideturtle()',
    colori: [[[-150, 100], "purple"]],
    vuoti: [[-100, 50], [-50, 25]],
  },
  {
    nome: "scritta con write",
    codice: 'import turtle\nt = turtle.Turtle()\nt.hideturtle()\nt.penup()\nt.goto(-100, -150)\nt.write("Ciao Techland!", font=("Arial", 32, "bold"))',
    disegnati: { minimo: 100, zona: [-100, -150, 250, -100] },
  },
  {
    nome: "sfondo colorato con Screen().bgcolor",
    codice: 'import turtle\nschermo = turtle.Screen()\nschermo.bgcolor("yellow")\nt = turtle.Turtle()\nt.hideturtle()\nt.forward(10)',
    colori: [[[-390, 290], "yellow"], [[390, -290], "yellow"]],
  },
  {
    nome: "forma, velocità e hideturtle",
    codice: 'import turtle\nt = turtle.Turtle()\nt.shape("turtle")\nt.speed(0)\nt.color("orange")\nt.pensize(5)\nt.forward(150)\nt.hideturtle()',
    colori: [[[75, 0], "orange"]],
  },
  {
    nome: "due tartarughe",
    codice: [
      "import turtle",
      "a = turtle.Turtle()",
      "b = turtle.Turtle()",
      'a.color("red")',
      'b.color("blue")',
      "for t, y in ((a, 50), (b, -50)):",
      "    t.speed(0)",
      "    t.pensize(5)",
      "    t.penup()",
      "    t.goto(-100, y)",
      "    t.pendown()",
      "    t.forward(200)",
      "    t.hideturtle()",
    ].join("\n"),
    colori: [[[0, 50], "red"], [[0, -50], "blue"]],
  },
  {
    nome: "stella con i cicli",
    codice: 'import turtle\nt = turtle.Turtle()\nt.speed(0)\nt.pensize(3)\nfor _ in range(5):\n    t.forward(200)\n    t.right(144)\nt.hideturtle()',
    disegnati: { minimo: 1500 },
  },
  {
    nome: "tracer(0) e update() per disegnare di colpo",
    codice: 'import turtle\nturtle.tracer(0)\nt = turtle.Turtle()\nt.color("blue")\nt.begin_fill()\nfor _ in range(4):\n    t.forward(80)\n    t.left(90)\nt.end_fill()\nt.hideturtle()\nturtle.update()',
    colori: [[[40, 40], "blue"]],
  },
  {
    nome: "print insieme al disegno",
    codice: 'import turtle\nt = turtle.Turtle()\nt.speed(0)\nfor lato in range(4):\n    t.forward(60)\n    t.left(90)\n    print("lato", lato + 1)\nprint("fatto!")',
    output: "lato 1\nlato 2\nlato 3\nlato 4\nfatto!\n",
    disegnati: { minimo: 200 },
  },
  {
    nome: "colori casuali con random",
    codice: 'import turtle, random\nt = turtle.Turtle()\nt.speed(0)\nt.pensize(5)\nt.color(random.choice(["red", "red"]))\nt.forward(100)\nprint(random.randint(1, 1))',
    colori: [[[50, 0], "red"]],
    output: "1\n",
  },
  {
    nome: "velocità normale (animazione)",
    codice: 'import turtle\nt = turtle.Turtle()\nt.color("green")\nt.pensize(5)\nt.forward(60)\nt.left(90)\nt.forward(60)',
    colori: [[[30, 0], "green"], [[60, 30], "green"]],
  },
];

test.beforeEach(async ({ fake, page }) => {
  await preparaAlunno(page, fake, "python-base", { python_env: "turtle", default_python_code: "import turtle\n" });
});

function controllaDisegno(caso: Caso, disegno: Disegno) {
  const intorno = ([x, y]: Punto, r: number) => {
    const out: number[][] = [];
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) out.push(colore(disegno, x + dx, y + dy));
    return out;
  };

  for (const [punto, nome] of caso.colori ?? []) {
    // Le linee sono sottili e sfumate: basta un pixel del colore giusto vicino al punto
    expect.soft(intorno(punto, 2).some((c) => vicino(c, RGB[nome])), `${caso.nome}: ${nome} in (${punto})`).toBe(true);
  }
  for (const punto of caso.vuoti ?? []) {
    expect.soft(intorno(punto, 1).every((c) => vicino(c, disegno.fondo, 10)), `${caso.nome}: niente in (${punto})`).toBe(true);
  }
  if (caso.disegnati) {
    expect.soft(pixelDisegnati(disegno, caso.disegnati.zona), `${caso.nome}: pixel disegnati`).toBeGreaterThanOrEqual(caso.disegnati.minimo);
  }
}

async function apriTurtle(page: Page) {
  await page.goto(taskUrl);
  await expect(page.getByText("🐢 Python Turtle")).toBeVisible();
  await expect(page.getByRole("button", { name: "Esegui" })).toBeEnabled({ timeout: 60_000 });
  return page.getByRole("textbox", { name: "Codice Python" });
}

test("Esegui: i disegni tipici dei corsi escono giusti", async ({ page }) => {
  test.slow();
  const editor = await apriTurtle(page);

  for (const caso of CASI) {
    await test.step(caso.nome, async () => {
      await editor.fill(caso.codice);
      const esito = await eseguiTurtle(page);
      expect.soft(esito.errore, caso.nome).toBeNull();
      if (caso.output !== undefined) expect.soft(esito.output, caso.nome).toBe(caso.output);
      controllaDisegno(caso, await leggiDisegno(page));
    });
  }
});

test("Esegui: input(), errori in italiano e Stop su un ciclo infinito", async ({ page }) => {
  test.slow();
  const editor = await apriTurtle(page);

  await test.step("input() chiede il numero di lati", async () => {
    await editor.fill('import turtle\nlati = int(input("Quanti lati? "))\nt = turtle.Turtle()\nt.speed(0)\nfor _ in range(lati):\n    t.forward(50)\n    t.left(360 / lati)\nprint("Disegno", lati, "lati")');
    const prompt = rispondiAiPrompt(page, ["6"]);
    const esito = await eseguiTurtle(page);
    prompt.stop();
    expect(prompt.messaggi).toEqual(["Quanti lati? "]);
    expect(esito).toEqual({ output: "Disegno 6 lati\n", errore: null });
  });

  await test.step("NameError con la riga", async () => {
    await editor.fill("import turtle\nt = turtle.Turtle()\nt.forward(50)\nprint(lato)");
    const esito = await eseguiTurtle(page);
    expect(esito.errore).toContain("Hai usato un nome che Python non conosce · riga 4");
  });

  await test.step("comando sbagliato della tartaruga", async () => {
    await editor.fill("import turtle\nt = turtle.Turtle()\nt.forwad(100)");
    const esito = await eseguiTurtle(page);
    expect(esito.errore).toContain("Comando che non esiste · riga 3");
  });

  await test.step("Stop ferma un ciclo infinito", async () => {
    await editor.fill("import turtle\nt = turtle.Turtle()\nt.speed(0)\nwhile True:\n    t.left(1)");
    await page.getByRole("button", { name: "Esegui" }).click();
    const stop = page.getByRole("button", { name: "Stop" });
    await expect(stop).toBeVisible();
    await page.waitForTimeout(500);
    await stop.click();
    await expect(page.getByRole("button", { name: "Esegui" })).toBeEnabled({ timeout: 10_000 });
    // Si può subito eseguire altro codice
    await editor.fill('print("ripartito")');
    expect((await eseguiTurtle(page)).output).toContain("ripartito");
  });
});

test("il compito con import turtle si apre nel compilatore Turtle anche se l'ambiente è standard", async ({ page, fake }) => {
  impostaCodice(fake, { python_env: "standard", default_python_code: "import turtle\nt = turtle.Turtle()\nt.forward(100)\n" });
  await page.goto(compitoUrl);
  await expect(page.getByText("🐢 Python Turtle")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Codice Python" })).toHaveValue("import turtle\nt = turtle.Turtle()\nt.forward(100)\n");
  await expect(page.getByPlaceholder("Scrivi il tuo codice Python...")).toHaveCount(0);
});
