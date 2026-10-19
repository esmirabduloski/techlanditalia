import { test, expect } from "./support/test";
import { parent, student } from "./support/seed";
import type { FakeSupabase, FakeUser } from "./support/fakeSupabase";

/**
 * Calendario di chiusure e festività (tabella school_closures).
 * L'admin le gestisce in /admin/chiusure; il genitore le vede in anticipo
 * nell'area riservata, con un avviso in cima la settimana prima.
 */

// Lunedì (prima della data reale: la sessione finta non deve risultare scaduta).
// La formazione docenti inizia venerdì, tra 4 giorni.
const TODAY = "2026-10-12";

const closures = [
  { title: "Festa passata", start_date: "2026-10-04", end_date: "2026-10-04", note: null },
  { title: "Vacanze di Natale", start_date: "2026-12-23", end_date: "2027-01-06", note: "Le lezioni riprendono giovedì 7 gennaio" },
  { title: "Formazione docenti", start_date: "2026-10-16", end_date: "2026-10-17", note: null },
  { title: "Immacolata Concezione", start_date: "2026-12-08", end_date: "2026-12-08", note: null },
  { title: "Pasqua e Pasquetta", start_date: "2027-03-28", end_date: "2027-03-29", note: null },
  { title: "Festa della Liberazione", start_date: "2027-04-25", end_date: "2027-04-25", note: null },
];

const admin: FakeUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "admin@techland.test",
  password: "password-di-prova",
  fullName: "Admin Techland",
};

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${TODAY}T10:00:00+02:00`));
});

test.describe("area genitore", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  function seedFamily(fake: FakeSupabase) {
    fake.addUser(parent);
    fake.seed("profiles", [
      { id: parent.id, full_name: parent.fullName, role: "parent", parent_id: null, avatar_id: 1, total_points: 0, onboarding_completed: true },
      { id: student.id, full_name: student.fullName, username: student.username, role: "student", parent_id: parent.id, total_points: 0, avatar_id: 2 },
    ]);
  }

  test("vede le chiusure in anticipo, con l'avviso per quella vicina", async ({ page, fake }) => {
    seedFamily(fake);
    fake.seed("school_closures", closures);
    await fake.signInBeforeLoad(page, parent);
    await page.goto("/area-riservata");

    const banner = page.getByRole("link", { name: /Niente lezioni: Formazione docenti/ });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Dal 16 al 17 ottobre");
    await expect(banner).toContainText("Tra 4 giorni");

    const card = page.locator("#chiusure");
    await expect(card.getByText("Chiusure e festività")).toBeVisible();
    const items = card.getByRole("listitem");
    // Le passate non ci sono; dalla più vicina, 4 alla volta
    await expect(items).toHaveCount(4);
    await expect(card).not.toContainText("Festa passata");
    await expect(items.nth(0)).toContainText("Formazione docenti");
    await expect(items.nth(0)).toContainText("Dal 16 al 17 ottobre · 2 giorni");
    await expect(items.nth(0)).toContainText("Tra 4 giorni");
    await expect(items.nth(1)).toContainText("Martedì 8 dicembre");
    await expect(items.nth(2)).toContainText("Dal 23 dicembre 2026 al 6 gennaio 2027 · 15 giorni");
    await expect(items.nth(2)).toContainText("Le lezioni riprendono giovedì 7 gennaio");
    await expect(items.nth(3)).toContainText("Dal 28 al 29 marzo 2027");

    await card.getByRole("button", { name: "Mostra tutte (1 in più)" }).click();
    await expect(items).toHaveCount(5);
    await expect(items.nth(4)).toContainText("Domenica 25 aprile 2027");

    // L'avviso porta al calendario completo
    await banner.click();
    await expect(card).toBeInViewport();

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      wide: [...document.querySelectorAll("main *")].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).length,
    }));
    expect(overflow).toEqual({ scrollWidth: 390, wide: 0 });
  });

  test("senza chiusure in programma non mostra nulla", async ({ page, fake }) => {
    seedFamily(fake);
    fake.seed("school_closures", [closures[0]]);
    await fake.signInBeforeLoad(page, parent);
    await page.goto("/area-riservata");

    await expect(page.getByRole("heading", { name: "Ciao, Maria! 👋" })).toBeVisible();
    await expect(page.getByText(`Nessun corso attivo per ${student.fullName}`)).toBeVisible();
    await expect(page.getByText("Chiusure e festività")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Niente lezioni/ })).toHaveCount(0);
  });
});

test.describe("admin", () => {
  const activeGroup = { id: "e2000000-0000-4000-8000-000000000001", title: "Python Base - Martedì", status: "active" };
  const archivedGroup = { id: "e2000000-0000-4000-8000-000000000002", title: "Scratch - Vecchio", status: "archived" };

  test.beforeEach(async ({ page, fake }) => {
    fake.addUser(admin);
    fake.seed("profiles", [{ id: admin.id, full_name: admin.fullName, role: "admin" }]);
    fake.seed("user_roles", [{ user_id: admin.id, role: "admin" }]);
    // Le famiglie sono già state avvisate delle vacanze di Natale
    fake.seed("school_closures", [closures[0], { ...closures[1], notified_at: "2026-10-10T07:00:00Z" }]);
    fake.seed("group_lesson_schedule", [
      // Una lezione dentro le vacanze di Natale da spostare, una dopo, una di un gruppo archiviato
      { group_id: activeGroup.id, lesson_number: 9, lesson_date: "2026-12-29", group: activeGroup },
      { group_id: activeGroup.id, lesson_number: 10, lesson_date: "2027-01-12", group: activeGroup },
      { group_id: archivedGroup.id, lesson_number: 4, lesson_date: "2026-12-24", group: archivedGroup },
    ]);
    await fake.signInBeforeLoad(page, admin);
  });

  test("aggiunge, modifica ed elimina le chiusure e carica le festività", async ({ page, fake }) => {
    await page.goto("/admin/chiusure");
    await expect(page.getByRole("heading", { name: "Chiusure e festività" })).toBeVisible();

    const list = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: /^Modifica / }) });
    await expect(list).toHaveCount(1);
    const natale = list.filter({ hasText: "Vacanze di Natale" });
    await expect(natale).toContainText("1 lezione in calendario in questi giorni");
    await expect(natale).toContainText("Python Base - Martedì · lezione 9 · mar 29 dic");
    await expect(natale).not.toContainText("Scratch");
    await expect(natale.getByText("Famiglie avvisate il 10/10")).toBeVisible();

    // Date al contrario: niente salvataggio
    await page.getByLabel("Nome").fill("Ponte dei Santi");
    await page.getByLabel("Dal", { exact: true }).fill("2026-11-02");
    await page.getByLabel("Fino al (compreso)").fill("2026-10-30");
    await page.getByRole("button", { name: "Aggiungi chiusura" }).click();
    await expect(page.getByText("L'ultimo giorno non può essere prima del primo", { exact: true })).toBeVisible();
    expect(fake.table("school_closures")).toHaveLength(2);

    await page.getByLabel("Dal", { exact: true }).fill("2026-10-30");
    await page.getByLabel("Fino al (compreso)").fill("2026-11-02");
    await page.getByLabel("Nota per i genitori (facoltativa)").fill("Si riprende martedì 3");
    await page.getByRole("button", { name: "Aggiungi chiusura" }).click();
    await expect(page.getByText("Chiusura aggiunta", { exact: true })).toBeVisible();
    await expect(list).toHaveCount(2);
    await expect(list.first()).toContainText("Ponte dei Santi");
    expect(fake.table("school_closures").find((c) => c.title === "Ponte dei Santi")).toMatchObject({
      start_date: "2026-10-30", end_date: "2026-11-02", note: "Si riprende martedì 3",
    });

    // Festività: San Francesco è passato, Ognissanti è nel ponte, Natale/Capodanno/Epifania nelle vacanze
    await page.getByRole("button", { name: "Festività 2026/27" }).click();
    await expect(page.getByText("Aggiunte 6 festività", { exact: true })).toBeVisible();
    await expect(list).toHaveCount(8);
    expect(fake.table("school_closures").map((c) => c.title)).toEqual(expect.arrayContaining([
      "Immacolata Concezione", "Pasqua e Pasquetta", "Festa della Liberazione", "Festa dei Lavoratori", "Festa della Repubblica", "Ferragosto",
    ]));
    // Una seconda volta non aggiunge doppioni
    await page.getByRole("button", { name: "Festività 2026/27" }).click();
    await expect(page.getByText("Le festività 2026/27 sono già nel calendario", { exact: true })).toBeVisible();
    expect(fake.table("school_closures")).toHaveLength(9);

    // Modifica
    await page.getByRole("button", { name: "Modifica Ponte dei Santi" }).click();
    await expect(page.getByLabel("Nome")).toHaveValue("Ponte dei Santi");
    await page.getByLabel("Nome").fill("Ponte di Ognissanti");
    await page.getByRole("button", { name: "Salva modifiche" }).click();
    await expect(page.getByText("Chiusura aggiornata", { exact: true })).toBeVisible();
    await expect(list.first()).toContainText("Ponte di Ognissanti");

    // Eliminazione con conferma
    await page.getByRole("button", { name: "Elimina Ferragosto" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Elimina" }).click();
    await expect(list).toHaveCount(7);
    expect(fake.table("school_closures").some((c) => c.title === "Ferragosto")).toBe(false);

    // Le passate solo a richiesta
    await expect(page.getByText("Festa passata")).toHaveCount(0);
    // Da tastiera: in cima alla scheda l'interruttore resta sotto l'intestazione fissa
    await page.getByLabel("Anche passate").focus();
    await page.keyboard.press("Space");
    await expect(page.getByText("Festa passata")).toBeVisible();
  });
});
