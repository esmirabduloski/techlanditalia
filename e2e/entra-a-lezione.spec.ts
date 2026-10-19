import { test, expect } from "./support/test";
import { parent, student, course, seedStudent } from "./support/seed";
import type { FakeSupabase } from "./support/fakeSupabase";

/**
 * Il pulsante grande «Entra a lezione» in cima all'area riservata, il giorno della
 * lezione. C'è anche nell'area genitore: i più piccoli si collegano spesso dal
 * computer o dal telefono di mamma o papà.
 */

const TODAY = "2026-10-16";
const sister = { id: "33333333-3333-4333-8333-333333333333", fullName: "Giulia Bianchi" };
const group = {
  id: "e2000000-0000-4000-8000-000000000001",
  title: "Python Base - Venerdì",
  lesson_time: "17:30:00",
  status: "active",
  student_meeting_link: "https://meet.example.test/python",
  course_id: course.id,
  course,
};

/** Lezione 5 la settimana scorsa, lezione 6 il giorno indicato. */
function seedGroup(fake: FakeSupabase, studentIds: string[], lessonDate = TODAY) {
  fake.seed("group_students", studentIds.map((id) => ({ group_id: group.id, student_id: id, group })));
  fake.seed("student_groups", [{ id: group.id, course_id: course.id, title: group.title }]);
  fake.seed("group_lesson_schedule", [
    { group_id: group.id, lesson_number: 5, lesson_date: "2026-10-09", lesson_title: null, lesson_time: null, group },
    { group_id: group.id, lesson_number: 6, lesson_date: lessonDate, lesson_title: null, lesson_time: null, group },
  ]);
}

function seedFamily(fake: FakeSupabase) {
  fake.addUser(parent);
  fake.seed("profiles", [
    { id: parent.id, full_name: parent.fullName, role: "parent", parent_id: null, avatar_id: 1, total_points: 0, onboarding_completed: true },
    { id: student.id, full_name: student.fullName, username: student.username, role: "student", parent_id: parent.id, total_points: 0, avatar_id: 2, lesson_balance: 6 },
    { id: sister.id, full_name: sister.fullName, username: "giulia77", role: "student", parent_id: parent.id, total_points: 0, avatar_id: 3, lesson_balance: 6 },
  ]);
  fake.seed("courses", [course]);
}

const joinButton = (page: import("@playwright/test").Page) => page.getByRole("link", { name: /^🚀 ENTRA A LEZIONE/ });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${TODAY}T10:00:00+02:00`));
});

test.describe("area genitore dal telefono", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("il giorno della lezione il pulsante è in cima, con il nome del figlio", async ({ page, fake }) => {
    seedFamily(fake);
    seedGroup(fake, [student.id]);
    await fake.signInBeforeLoad(page, parent);
    await page.goto("/area-riservata");

    const join = joinButton(page);
    await expect(join).toHaveAttribute("href", group.student_meeting_link);
    await expect(join).toContainText("Luca · 🐍 Lezione 6 · ore 17:30");
    await expect(join).toBeInViewport();

    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBe(390);
  });

  test("due fratelli nello stesso gruppo hanno un pulsante solo", async ({ page, fake }) => {
    seedFamily(fake);
    seedGroup(fake, [student.id, sister.id]);
    await fake.signInBeforeLoad(page, parent);
    await page.goto("/area-riservata");

    await expect(joinButton(page)).toContainText("Luca e Giulia · 🐍 Lezione 6");
    await expect(joinButton(page)).toHaveCount(1);
  });

  test("senza lezione oggi il pulsante non c'è", async ({ page, fake }) => {
    seedFamily(fake);
    seedGroup(fake, [student.id], "2026-10-23");
    await fake.signInBeforeLoad(page, parent);
    await page.goto("/area-riservata");

    await expect(page.getByText("Prossima lezione")).toBeVisible();
    await expect(joinButton(page)).toHaveCount(0);
  });
});

test("l'alunno vede lo stesso pulsante, senza nome", async ({ page, fake }) => {
  seedStudent(fake);
  seedGroup(fake, [student.id]);
  await fake.signInBeforeLoad(page, student);
  await page.goto("/area-riservata");

  const join = joinButton(page);
  await expect(join).toHaveAttribute("href", group.student_meeting_link);
  await expect(join).toContainText("🐍 Lezione 6 · ore 17:30");
  await expect(join).not.toContainText("Luca");
});
