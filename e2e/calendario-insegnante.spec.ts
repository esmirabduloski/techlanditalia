import { test, expect } from "./support/test";
import { course } from "./support/seed";
import type { FakeSupabase } from "./support/fakeSupabase";

/**
 * Lezioni dell'insegnante nel suo Google Calendar: dal calendario della
 * dashboard apre il pannello, si iscrive con il link segreto (edge function
 * teacher-calendar-feed) e, se serve, lo rigenera.
 */

const teacher = {
  id: "55555555-5555-4555-8555-555555555555",
  email: "giulia.neri@techland.test",
  password: "password-di-prova",
  fullName: "Giulia Neri",
};
const GROUP_ID = "e3000000-0000-4000-8000-000000000001";
const FIRST = "a".repeat(48);
const SECOND = "b".repeat(48);
const FEED = (token: string) => `https://supabase.e2e.test/functions/v1/teacher-calendar-feed/${token}.ics`;

const isoInDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

function seedTeacher(fake: FakeSupabase, lastFetchedAt: string | null) {
  fake.addUser(teacher);
  fake.seed("profiles", [{
    id: teacher.id, full_name: teacher.fullName, role: "parent", parent_id: null, onboarding_completed: true,
  }]);
  fake.seed("user_roles", [{ user_id: teacher.id, role: "teacher" }]);
  fake.seed("student_groups", [{
    id: GROUP_ID, title: "Python Base - Lunedì", course_id: course.id, start_date: isoInDays(-30), max_lessons: 32,
    teacher_id: teacher.id, lesson_days: [1], lesson_time: "17:00:00", status: "active", archived_at: null,
    whatsapp_link: null, teacher_meeting_link: "https://meet.google.com/abc-defg-hij", certificates: [],
    courses: { title: course.title, emoji: course.emoji },
  }]);
  fake.seed("group_lesson_schedule", [1, 8, 15].map((days, i) => ({
    id: `e3000000-0000-4000-8000-00000000010${i}`, group_id: GROUP_ID, lesson_number: 5 + i,
    lesson_date: isoInDays(days), lesson_title: null, lesson_time: null, recording_url: null,
  })));

  let token = FIRST;
  fake.rpc("teacher_calendar_feed", (body) => {
    if ((body as { p_rotate?: boolean } | null)?.p_rotate) token = SECOND;
    return [{ token, created_at: "2026-10-01T08:00:00Z", last_fetched_at: token === FIRST ? lastFetchedAt : null }];
  });
}

test("l'insegnante aggiunge le lezioni a Google Calendar e rigenera il link", async ({ page, fake }) => {
  seedTeacher(fake, null);
  await fake.signInBeforeLoad(page, teacher);
  await page.goto("/insegnante");

  await page.getByRole("button", { name: "Google Calendar" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Le lezioni nel tuo Google Calendar" })).toBeVisible();

  const google = dialog.getByRole("link", { name: "Aggiungi a Google Calendar" });
  const href = await google.getAttribute("href");
  expect(new URL(href!).origin).toBe("https://calendar.google.com");
  expect(new URL(href!).searchParams.get("cid")).toBe(FEED(FIRST).replace("https://", "webcal://"));
  await expect(google).toHaveAttribute("target", "_blank");
  await expect(dialog.getByRole("textbox", { name: "Link del calendario" })).toHaveValue(FEED(FIRST));
  await expect(dialog.getByRole("link", { name: "apri nell'app Calendario" }))
    .toHaveAttribute("href", FEED(FIRST).replace("https://", "webcal://"));
  await expect(dialog.getByText("Non ancora collegato a nessun calendario.")).toBeVisible();

  // Rigenerando cambia il link
  await dialog.getByRole("button", { name: "Rigenera link" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Il link attuale smette di funzionare");
  await confirm.getByRole("button", { name: "Rigenera" }).click();
  await expect(confirm).toBeHidden();
  await expect(dialog.getByRole("textbox", { name: "Link del calendario" })).toHaveValue(FEED(SECOND));
  await expect(page.getByText("Nuovo link creato: aggiungi di nuovo il calendario", { exact: true })).toBeVisible();
});

test("mostra quando il calendario è stato letto l'ultima volta", async ({ page, fake }) => {
  seedTeacher(fake, new Date(Date.now() - 3 * 3_600_000).toISOString());
  await fake.signInBeforeLoad(page, teacher);
  await page.goto("/insegnante");

  await page.getByRole("button", { name: "Google Calendar" }).click();
  await expect(page.getByRole("dialog").getByText("Collegato: letto da un calendario circa 3 ore fa")).toBeVisible();
});

test.describe("collegamento diretto a Google", () => {
  type Connection = Record<string, unknown> | null;
  const connected = (over: Record<string, unknown> = {}) => ({
    google_email: "giulia.neri@gmail.com", status: "active", last_error: null,
    last_synced_at: new Date(Date.now() - 2 * 60_000).toISOString(), pending: false,
    connected_at: "2026-10-20T08:00:00Z", ...over,
  });

  /** Edge function google-calendar finta: risponde come quella vera, con lo stato in memoria. */
  function fakeGoogleFunction(fake: FakeSupabase, initial: Connection) {
    let connection = initial;
    fake.fn("google-calendar", (body) => {
      const { action, code, state } = body as { action: string; code?: string; state?: string };
      if (action === "status") return { body: { configured: true, connection } };
      if (action === "start") return { body: { url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=x&state=s" } };
      if (action === "finish") {
        if (code !== "codice-google" || state !== "stato-1") return { status: 400, body: { error: "Il collegamento è scaduto: riprova dalla dashboard", reason: "expired" } };
        connection = connected({ last_synced_at: new Date().toISOString() });
        return { body: { ok: true, connection, sync: { ok: true, stats: { inserted: 3, updated: 0, removed: 0, unchanged: 0 } } } };
      }
      if (action === "sync") {
        connection = connected({ last_synced_at: new Date().toISOString() });
        return { body: { ok: true, connection, sync: { ok: true, stats: { inserted: 0, updated: 1, removed: 0, unchanged: 2 } } } };
      }
      if (action === "disconnect") {
        connection = null;
        return { body: { ok: true } };
      }
      return { status: 400, body: { error: "Azione non valida" } };
    });
  }

  test("collega l'account: va su Google e al ritorno le lezioni sono copiate", async ({ page, fake }) => {
    seedTeacher(fake, null);
    fakeGoogleFunction(fake, null);
    await page.route("https://accounts.google.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Google finto</h1>" }));
    await fake.signInBeforeLoad(page, teacher);
    await page.goto("/insegnante");

    await page.getByRole("button", { name: "Google Calendar" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("TECHLAND gestisce solo quel calendario: non vede e non modifica gli altri.", { exact: false })).toBeVisible();
    // Il link .ics resta tra le alternative, chiuso
    await expect(dialog.getByRole("textbox", { name: "Link del calendario" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Altri calendari (Apple, Outlook) o link da copiare" }).click();
    await expect(dialog.getByRole("textbox", { name: "Link del calendario" })).toHaveValue(FEED(FIRST));

    await dialog.getByRole("button", { name: "Collega Google Calendar" }).click();
    await page.waitForURL(/accounts\.google\.com/);
    expect(fake.callsTo("google-calendar").map((c) => (c.body as { action: string }).action)).toEqual(["status", "start"]);

    // Google rimanda alla pagina del sito con codice e state
    await page.goto("/insegnante/google-calendar?code=codice-google&state=stato-1&scope=x");
    await page.waitForURL(/\/insegnante$/);
    await expect(page.getByText("Google Calendar collegato a giulia.neri@gmail.com", { exact: true })).toBeVisible();
    const finish = fake.callsTo("google-calendar").find((c) => (c.body as { action: string }).action === "finish");
    expect(finish?.body).toEqual({ action: "finish", code: "codice-google", state: "stato-1" });

    await page.getByRole("button", { name: "Google Calendar" }).click();
    await expect(page.getByRole("dialog").getByText("Collegato a giulia.neri@gmail.com")).toBeVisible();
  });

  test("ritorno da Google con un collegamento scaduto o annullato", async ({ page, fake }) => {
    seedTeacher(fake, null);
    fakeGoogleFunction(fake, null);
    await fake.signInBeforeLoad(page, teacher);

    await page.goto("/insegnante/google-calendar?code=vecchio&state=stato-0");
    await expect(page.getByText("Il collegamento è scaduto: riprova dalla dashboard")).toBeVisible();
    // Il codice non resta nell'indirizzo
    expect(page.url()).not.toContain("code=");

    await page.goto("/insegnante/google-calendar?error=access_denied&state=stato-1");
    await expect(page.getByText("Hai annullato il collegamento su Google", { exact: false })).toBeVisible();
    await page.getByRole("link", { name: "Torna alla dashboard" }).click();
    await page.waitForURL(/\/insegnante$/);
  });

  test("collegato: aggiorna ora e scollega", async ({ page, fake }) => {
    seedTeacher(fake, null);
    fakeGoogleFunction(fake, connected());
    await fake.signInBeforeLoad(page, teacher);
    await page.goto("/insegnante");

    await page.getByRole("button", { name: "Google Calendar" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Collegato a giulia.neri@gmail.com")).toBeVisible();
    await expect(dialog.getByText("Aggiornato 2 minuti fa", { exact: false })).toBeVisible();

    await dialog.getByRole("button", { name: "Aggiorna ora" }).click();
    await expect(page.getByText("Google Calendar aggiornato", { exact: true })).toBeVisible();

    await dialog.getByRole("button", { name: "Scollega" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("viene tolto dal tuo Google Calendar");
    await confirm.getByRole("button", { name: "Scollega" }).click();
    await expect(dialog.getByRole("button", { name: "Collega Google Calendar" })).toBeVisible();
    expect(fake.callsTo("google-calendar").map((c) => (c.body as { action: string }).action))
      .toEqual(["status", "sync", "disconnect"]);
  });

  test("accesso revocato da Google: chiede di ricollegare", async ({ page, fake }) => {
    seedTeacher(fake, null);
    fakeGoogleFunction(fake, connected({
      status: "revoked",
      last_error: "Google ha tolto l'accesso a TECHLAND: collega di nuovo il tuo account.",
    }));
    await fake.signInBeforeLoad(page, teacher);
    await page.goto("/insegnante");

    await page.getByRole("button", { name: "Google Calendar" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Google ha tolto l'accesso a TECHLAND: collega di nuovo il tuo account.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Collega di nuovo" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Aggiorna ora" })).toHaveCount(0);
  });
});
