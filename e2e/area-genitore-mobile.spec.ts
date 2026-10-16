import { test, expect } from "./support/test";
import { parent, student, course } from "./support/seed";
import type { FakeSupabase } from "./support/fakeSupabase";

/**
 * L'area genitore dal telefono: quasi tutti i genitori la aprono da lì.
 * In alto la scheda «In breve» (prossima lezione, lezioni rimaste, compiti,
 * presenze, ultimo commento), sotto le sezioni a scomparsa. Niente deve uscire
 * dallo schermo a 390px.
 */

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

// Data fissa: lo stato di lezioni e compiti dipende da "oggi"
const TODAY = "2026-10-16";
const sister = { id: "33333333-3333-4333-8333-333333333333", fullName: "Giulia Bianchi" };
const group = {
  id: "e1000000-0000-4000-8000-000000000001",
  title: "Python Base - Venerdì",
  lesson_time: "17:30:00",
  status: "active",
  student_meeting_link: "https://meet.example.test/python",
  course_id: course.id,
  course,
};

/** Lezioni settimanali: la 6ª è oggi, 5 già svolte, 4 da fare. */
const weeksFromToday = (n: number) => {
  const d = new Date(`${TODAY}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d.toISOString().slice(0, 10);
};
const lessons = Array.from({ length: 10 }, (_, i) => ({
  id: `a1000000-0000-4000-8000-0000000000${String(i).padStart(2, "0")}`,
  course_id: course.id,
  lesson_number: i + 1,
  title: `Lezione ${i + 1}`,
  objective: "creare un gioco con le variabili",
  course: { title: course.title, emoji: course.emoji },
}));
const hwId = (i: number) => `d1000000-0000-4000-8000-0000000000${String(i).padStart(2, "0")}`;

function seedFamily(fake: FakeSupabase) {
  fake.addUser(parent);
  fake.seed("profiles", [
    { id: parent.id, full_name: parent.fullName, role: "parent", parent_id: null, avatar_id: 1, total_points: 0, onboarding_completed: true },
    { id: student.id, full_name: student.fullName, username: student.username, role: "student", parent_id: parent.id, total_points: 340, avatar_id: 2, lesson_balance: 2 },
    { id: sister.id, full_name: sister.fullName, username: "giulia77", role: "student", parent_id: parent.id, total_points: 0, avatar_id: 3, lesson_balance: 6 },
  ]);
  fake.seed("courses", [course]);
  fake.seed("group_students", [{ group_id: group.id, student_id: student.id, group }]);
  fake.seed("student_groups", [{ id: group.id, course_id: course.id, title: group.title }]);
  fake.seed("lessons", lessons);
  fake.seed("group_lesson_schedule", lessons.map((l, i) => ({
    group_id: group.id,
    lesson_number: l.lesson_number,
    lesson_date: weeksFromToday(i - 5),
    lesson_title: null,
    lesson_time: null,
    group,
  })));
  fake.seed("homework", lessons.slice(0, 6).map((l, i) => ({ id: hwId(i), lesson_id: l.id, title: `Compito ${i + 1}` })));
  // L1 valutato, L2 consegnato, L3 e L4 scaduti senza consegna, L5 scade oggi, L6 la prossima settimana
  fake.seed("homework_submissions", [
    { homework_id: hwId(0), student_id: student.id, submitted_at: `${weeksFromToday(-5)}T18:00:00Z`, status: "graded", grade: 85, teacher_feedback: "Ottimo lavoro, codice ordinato." },
    { homework_id: hwId(1), student_id: student.id, submitted_at: `${weeksFromToday(-4)}T18:00:00Z`, status: "pending", grade: null, teacher_feedback: null },
  ]);
  fake.seed("group_attendance", [
    { group_id: group.id, lesson_number: 1, student_id: student.id, status: "present" },
    { group_id: group.id, lesson_number: 2, student_id: student.id, status: "present" },
    { group_id: group.id, lesson_number: 3, student_id: student.id, status: "justified" },
    { group_id: group.id, lesson_number: 4, student_id: student.id, status: "present" },
    // Lezione 5 senza registro = assenza; la 6 è oggi e non conta ancora
  ]);
  fake.seed("lesson_balance_log", [
    { student_id: student.id, operation_type: "purchase", amount: 8, balance_before: 0, balance_after: 8, notes: "Pacchetto 8 lezioni con una nota lunga che deve andare a capo", created_at: "2026-09-01T10:00:00Z" },
    { student_id: student.id, operation_type: "lesson_completed", amount: -1, balance_before: 8, balance_after: 7, notes: null, created_at: "2026-09-15T10:00:00Z" },
  ]);
  fake.seed("student_comments", [
    { student_id: student.id, content: "Luca partecipa con entusiasmo. Deve esercitarsi sui cicli.", visibility: ["parent"], created_at: "2026-10-09T10:00:00Z", author: { full_name: "Marco Verdi", role: "teacher" } },
  ]);
  fake.seed("badges", [
    { id: "b1000000-0000-4000-8000-000000000001", name: "Prima lezione", description: "Hai seguito la tua prima lezione", emoji: "🎉", category: "lezioni", points_reward: 10 },
    { id: "b1000000-0000-4000-8000-000000000002", name: "Maratoneta", description: "10 lezioni di fila", emoji: "🏃", category: "lezioni", points_reward: 50 },
  ]);
  fake.seed("user_achievements", [{ user_id: student.id, badge_id: "b1000000-0000-4000-8000-000000000001", earned_at: "2026-09-20T10:00:00Z" }]);
}

test.beforeEach(async ({ page, fake }) => {
  await page.clock.setFixedTime(new Date(`${TODAY}T10:00:00+02:00`));
  seedFamily(fake);
  await fake.signInBeforeLoad(page, parent);
});

test("la scheda «In breve» riassume la giornata del figlio", async ({ page }) => {
  await page.goto("/area-riservata");

  await expect(page.getByRole("heading", { name: "Ciao, Maria! 👋" })).toBeVisible();
  // Due figli: schede scorrevoli col nome
  await expect(page.getByRole("tab", { name: "Luca" })).toHaveAttribute("aria-selected", "true");

  await expect(page.getByText("Lezione di oggi")).toBeVisible();
  await expect(page.getByRole("link", { name: "Entra in lezione" }).first()).toHaveAttribute("href", group.student_meeting_link);
  await expect(page.getByText("Imparerà a creare un gioco con le variabili.").first()).toBeVisible();

  await expect(page.getByRole("button", { name: "2 Lezioni rimaste" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Restano solo 2 lezioni/ })).toHaveAttribute("href", "/area-riservata/acquisti");
  await expect(page.getByRole("button", { name: "2 Compiti mancanti" })).toBeVisible();
  // 3 presenze su 5 lezioni svolte (la giustificata conta nel totale)
  await expect(page.getByRole("button", { name: "60% Presenze" })).toBeVisible();
  await expect(page.getByText("Luca partecipa con entusiasmo.", { exact: false })).toBeVisible();

  // Nessun elemento esce dallo schermo
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    wide: [...document.querySelectorAll("main *")].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).length,
  }));
  expect(overflow).toEqual({ scrollWidth: 390, wide: 0 });
});

test("dal riepilogo si apre la sezione Compiti e il dettaglio col commento", async ({ page }) => {
  await page.goto("/area-riservata");

  await page.getByRole("button", { name: "2 Compiti mancanti" }).click();
  await expect(page.getByRole("radio", { name: "Mancanti (2)" })).toBeVisible();
  await page.getByRole("radio", { name: "Mancanti (2)" }).click();
  await expect(page.getByRole("button", { name: /^Lezione \d: Compito \d, Mancante$/ })).toHaveCount(2);

  // Il compito che scade oggi non è ancora mancante
  await page.getByRole("radio", { name: /^Da fare/ }).click();
  await expect(page.getByRole("button", { name: "Lezione 5: Compito 5, Da fare" })).toBeVisible();

  await page.getByRole("radio", { name: /^Valutati/ }).click();
  await page.getByRole("button", { name: "Lezione 1: Compito 1, Valutato" }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: "Compito 1" })).toBeVisible();
  await expect(drawer.getByText("85%")).toBeVisible();
  await expect(drawer.getByText("Ottimo lavoro, codice ordinato.")).toBeVisible();
});

test("saldo in elenco, badge toccabili e cambio figlio", async ({ page }) => {
  await page.goto("/area-riservata");

  await page.getByRole("button", { name: /^Lezioni e pagamenti/ }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Acquisto" })).toContainText("Pacchetto 8 lezioni con una nota lunga che deve andare a capo");
  await expect(page.getByRole("table")).toBeHidden();

  await page.getByRole("button", { name: /^Traguardi/ }).click();
  await page.getByRole("button", { name: /Prima lezione/ }).click();
  await expect(page.getByText("Hai seguito la tua prima lezione")).toBeVisible();
  await expect(page.getByRole("button", { name: /Mostra quelli da sbloccare \(1\)/ })).toBeVisible();

  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBe(390);

  await page.getByRole("tab", { name: "Giulia" }).click();
  await expect(page.getByRole("heading", { name: sister.fullName })).toBeVisible();
  await expect(page.getByText(`Nessun corso attivo per ${sister.fullName}`)).toBeVisible();
});

test("il link #calendario apre il calendario delle lezioni", async ({ page }) => {
  await page.goto("/area-riservata#calendario");
  await expect(page.getByRole("button", { name: /^Calendario lezioni/ })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Lezione 7")).toBeVisible();
  await expect(page.getByText("🔒 Il materiale si apre quando è la prossima lezione").first()).toBeVisible();
});
