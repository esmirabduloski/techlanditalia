import { readFile } from "node:fs/promises";
import { test, expect } from "./support/test";
import { parent, student, course } from "./support/seed";
import type { FakeSupabase } from "./support/fakeSupabase";

/**
 * Attestati di fine corso: restano nascosti finché l'insegnante non li
 * sblocca il giorno dell'ultima lezione (regola verificata in SQL in
 * supabase/tests/rls/10_course_certificates.sql). Dopo, genitore e alunno
 * trovano la sezione Certificazioni con l'anteprima e il PDF da scaricare.
 *
 * CERT_SAMPLE_OUT=percorso.pdf salva il PDF generato (attestato di esempio).
 */

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const TODAY = "2026-10-16";
const sister = { id: "33333333-3333-4333-8333-333333333333", fullName: "Giulia Bianchi" };
const group = { id: "e1000000-0000-4000-8000-000000000001", title: "Python Base - Venerdì", course_id: course.id, course };

const certificate = {
  id: "ce000000-0000-4000-8000-000000000001",
  student_id: student.id,
  group_id: group.id,
  student_name: student.fullName,
  course_title: "Python Base",
  course_emoji: "🐍",
  teacher_name: "Marco Verdi",
  lessons_attended: 30,
  lessons_total: 32,
  hours_attended: 45,
  hard_skills: [
    "Sintassi e basi di Python",
    "Variabili, condizioni e cicli",
    "Funzioni e liste",
    "Giochi con la grafica in Python",
    "Lettura e correzione degli errori",
  ],
  soft_skills: ["Pensiero logico", "Problem solving", "Precisione", "Perseveranza"],
  issued_on: TODAY,
  code: "TL-2026-7K3QF",
  released_by: null,
  notified_at: "2026-10-16T17:00:00Z",
  created_at: "2026-10-16T17:00:00Z",
};

function seedFamily(fake: FakeSupabase) {
  fake.addUser(parent);
  fake.addUser(student);
  fake.seed("profiles", [
    { id: parent.id, full_name: parent.fullName, role: "parent", parent_id: null, avatar_id: 1, total_points: 0, onboarding_completed: true },
    { id: student.id, full_name: student.fullName, username: student.username, role: "student", parent_id: parent.id, total_points: 340, avatar_id: 2, lesson_balance: 2, onboarding_completed: true },
    { id: sister.id, full_name: sister.fullName, username: "giulia77", role: "student", parent_id: parent.id, total_points: 0, avatar_id: 3, lesson_balance: 6 },
  ]);
  fake.seed("courses", [course]);
  fake.seed("group_students", [{ group_id: group.id, student_id: student.id, group }]);
  fake.seed("student_groups", [{ id: group.id, course_id: course.id, title: group.title }]);
}

test.beforeEach(async ({ page, fake }) => {
  await page.clock.setFixedTime(new Date(`${TODAY}T18:00:00+02:00`));
  seedFamily(fake);
});

test("prima dello sblocco la sezione Certificazioni non c'è", async ({ page, fake }) => {
  await fake.signInBeforeLoad(page, parent);
  await page.goto("/area-riservata");

  await expect(page.getByRole("button", { name: /Calendario lezioni/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Certificazioni/ })).toHaveCount(0);
});

test("il genitore trova l'attestato nuovo e scarica il PDF", async ({ page, fake }) => {
  fake.seed("course_certificates", [certificate]);
  await fake.signInBeforeLoad(page, parent);
  await page.goto("/area-riservata#certificazioni");

  // Attestato appena sbloccato: la sezione parte aperta, con l'anteprima
  const section = page.getByTestId("parent-certificates");
  await expect(page.getByRole("button", { name: /Certificazioni.*Nuovo!/ })).toBeVisible();
  await expect(section.getByText("Complimenti a Luca!", { exact: false })).toBeVisible();
  await expect(section.getByText("🐍 Python Base")).toBeVisible();
  // 32 lezioni e 320 ore per tutti, anche con 30 presenze nel registro
  await expect(section.getByText("32 lezioni · 320 ore di coding · 16/10/2026")).toBeVisible();
  const preview = section.getByRole("img", { name: "Attestato di Luca Bianchi: Python Base" });
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  const downloadPromise = page.waitForEvent("download");
  await section.getByRole("button", { name: "Scarica PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Attestato-Luca-Bianchi-Python-Base.pdf");
  const pdf = await readFile((await download.path())!);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.length).toBeGreaterThan(50_000);
  if (process.env.CERT_SAMPLE_OUT) await download.saveAs(process.env.CERT_SAMPLE_OUT);

  // Nessun elemento esce dallo schermo
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBe(390);

  // La sorella non ha attestati: niente sezione
  await page.getByRole("tab", { name: "Giulia" }).click();
  await expect(page.getByRole("button", { name: /Certificazioni/ })).toHaveCount(0);
});

test("l'alunno festeggia e trova il proprio attestato", async ({ page, fake }) => {
  fake.seed("course_certificates", [certificate]);
  await fake.signInBeforeLoad(page, student);
  await page.goto("/area-riservata");

  await expect(page.getByText("🎓 Corso completato!")).toBeVisible();
  const card = page.getByTestId("student-certificates");
  await expect(card.getByRole("heading", { name: "Certificazioni" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Scarica PDF" })).toBeVisible();

  // I coriandoli solo la prima volta
  await page.getByText("Tocca per continuare").click({ force: true });
  await page.reload();
  await expect(card.getByRole("heading", { name: "Certificazioni" })).toBeVisible();
  await expect(page.getByText("🎓 Corso completato!")).toHaveCount(0);
});

test.describe("insegnante", () => {
  const teacher = {
    id: "44444444-4444-4444-8444-444444444444",
    email: "marco.verdi@techland.test",
    password: "password-di-prova",
    fullName: "Marco Verdi",
  };

  /** Gruppo di 32 lezioni: l'ultima è nel giorno indicato. */
  function seedGroup(fake: FakeSupabase, lastLessonDate: string) {
    fake.addUser(teacher);
    fake.seed("profiles", [{ id: teacher.id, full_name: teacher.fullName, role: "parent", parent_id: null }]);
    fake.seed("user_roles", [{ user_id: teacher.id, role: "teacher" }]);
    fake.seed("student_groups", [{
      id: "e2000000-0000-4000-8000-000000000001", title: "Python Base - Sabato", course_id: course.id,
      start_date: "2026-03-07", max_lessons: 32, teacher_id: teacher.id, lesson_days: [6], lesson_time: "10:00",
      status: "active", archived_at: null, whatsapp_link: null, teacher_meeting_link: null, certificates: [],
      courses: { title: course.title, emoji: course.emoji },
    }]);
    fake.seed("group_lesson_schedule", Array.from({ length: 32 }, (_, i) => ({
      group_id: "e2000000-0000-4000-8000-000000000001",
      lesson_number: i + 1,
      lesson_date: i === 31 ? lastLessonDate : `2026-0${3 + Math.floor(i / 5)}-0${1 + (i % 5)}`,
      lesson_title: null, lesson_time: null, recording_url: null,
    })));
    fake.seed("group_students", [{
      group_id: "e2000000-0000-4000-8000-000000000001", student_id: student.id,
      profiles: { full_name: student.fullName, avatar_id: 2, lesson_balance: 0 },
    }]);
    fake.seed("group_attendance", Array.from({ length: 30 }, (_, i) => ({
      group_id: "e2000000-0000-4000-8000-000000000001", student_id: student.id, lesson_number: i + 1, status: "present",
    })));
  }

  test("prima della lezione 32 il pulsante è bloccato", async ({ page, fake }) => {
    seedGroup(fake, "2026-10-17");
    await fake.signInBeforeLoad(page, teacher);
    await page.goto("/insegnante/gruppo/e2000000-0000-4000-8000-000000000001");

    const card = page.getByTestId("certificates-release-card");
    await expect(card.getByText("Gli attestati si sbloccano il giorno della lezione 32 (17/10/2026)", { exact: false })).toBeVisible();
    await expect(card.getByText("32 lezioni · 320 ore")).toBeVisible();
    await expect(card.getByRole("button", { name: "Rendi disponibili gli attestati" })).toBeDisabled();
  });

  test("il giorno della lezione 32 sblocca gli attestati e avvisa le famiglie", async ({ page, fake }) => {
    seedGroup(fake, TODAY);
    fake.rpc("release_group_certificates", (_body, { fake }) => {
      fake.seed("course_certificates", [{ ...certificate, group_id: "e2000000-0000-4000-8000-000000000001", notified_at: null }]);
      return [certificate];
    });
    fake.fn("certificates-released", () => ({ body: { ok: true, certificates: 1, emails: 1, pushes: 1 } }));
    await fake.signInBeforeLoad(page, teacher);
    await page.goto("/insegnante/gruppo/e2000000-0000-4000-8000-000000000001");

    const card = page.getByTestId("certificates-release-card");
    await expect(card.getByText("È il giorno della festa!")).toBeVisible();
    await card.getByRole("button", { name: "Rendi disponibili gli attestati" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("Luca Bianchi riceverà il proprio attestato");
    await page.getByRole("button", { name: "Sì, sblocca" }).click();

    await expect(page.getByText("Attestato disponibile", { exact: true })).toBeVisible();
    expect(fake.callsTo("certificates-released")).toHaveLength(1);
    expect(fake.callsTo("certificates-released")[0].body).toEqual({ group_id: "e2000000-0000-4000-8000-000000000001" });
    await expect(card.getByText("Disponibili dal 16/10/2026")).toBeVisible();
    await expect(card.getByRole("button", { name: "Scarica PDF" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Rendi disponibili gli attestati" })).toHaveCount(0);
  });
});
