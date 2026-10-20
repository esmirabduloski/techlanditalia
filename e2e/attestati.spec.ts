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

  // Senza la 0064 applicata (niente colonna shared_at): né QR né condivisione
  await expect(section.getByTestId("certificate-share")).toHaveCount(0);
  const svg = await preview.evaluate(async (img: HTMLImageElement) => (await fetch(img.src)).text());
  expect(svg).not.toContain('data-slot="QR_PATH"');

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
  await page.getByText("Tocca per continuare").click();
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

test.describe("verifica e condivisione", () => {
  // Riga con le colonne della 0064: privato finché la famiglia non decide
  const privateCert = { ...certificate, shared_at: null, shared_by: null, shared_as: null };
  const verifiedPublic = {
    code: certificate.code,
    is_public: true,
    student_name: certificate.student_name,
    course_title: certificate.course_title,
    course_emoji: certificate.course_emoji,
    teacher_name: certificate.teacher_name,
    issued_on: certificate.issued_on,
    hard_skills: certificate.hard_skills,
    soft_skills: certificate.soft_skills,
  };
  const verifiedPrivate = { ...verifiedPublic, is_public: false, student_name: "L. B.", teacher_name: null, hard_skills: [], soft_skills: [] };

  /** Come set_certificate_public(): aggiorna la riga e la restituisce. */
  function fakeSharing(fake: FakeSupabase) {
    fake.rpc("set_certificate_public", (args, { fake: f, userId }) => {
      const { p_certificate_id, p_public } = args as { p_certificate_id: string; p_public: boolean };
      const row = f.table("course_certificates").find((c) => c.id === p_certificate_id)!;
      Object.assign(row, p_public
        ? { shared_at: "2026-10-16T18:00:00Z", shared_by: userId, shared_as: userId === parent.id ? "parent" : "student" }
        : { shared_at: null, shared_by: null, shared_as: null });
      return row;
    });
  }

  /** Come verify_certificate(): una riga per il codice giusto, nessuna per gli altri. */
  function fakeVerify(fake: FakeSupabase, row: typeof verifiedPublic) {
    const codes: string[] = [];
    fake.rpc("verify_certificate", (args) => {
      const { p_code } = args as { p_code: string };
      codes.push(p_code);
      return p_code === row.code ? [row] : [];
    });
    return codes;
  }

  test("il genitore rende pubblico l'attestato: QR sul PDF, LinkedIn e immagine per Instagram", async ({ page, fake }) => {
    fake.seed("course_certificates", [privateCert]);
    fakeSharing(fake);
    // Computer senza condivisione di file: l'immagine si scarica
    await page.addInitScript(() => Object.defineProperty(navigator, "canShare", { value: undefined }));
    await fake.signInBeforeLoad(page, parent);
    await page.goto("/area-riservata#certificazioni");

    const section = page.getByTestId("parent-certificates");
    const share = section.getByTestId("certificate-share");
    await expect(share.getByText("Condividi su LinkedIn o Instagram")).toBeVisible();
    await expect(share.getByText("Ora chi inquadra il QR code vede solo le iniziali", { exact: false })).toBeVisible();
    await expect(share.getByRole("link", { name: "Aggiungi a LinkedIn" })).toHaveCount(0);

    // Con la 0064 l'attestato ha il QR code di verifica
    const preview = section.getByRole("img", { name: "Attestato di Luca Bianchi: Python Base" });
    await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    const svg = await preview.evaluate(async (img: HTMLImageElement) => (await fetch(img.src)).text());
    expect(svg).toContain('data-slot="QR_PATH"');
    expect(svg).toContain("verificalo su techlanditalia.it/attestato");

    // Prima di rendere pubblico si conferma, sapendo cosa si vedrà
    await expect(share.getByRole("switch", { name: "Condividi su LinkedIn o Instagram" })).not.toBeChecked();
    await share.getByText("Condividi su LinkedIn o Instagram").click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Rendere pubblico l'attestato di Luca?");
    await expect(dialog).toContainText("nome e cognome di Luca, il corso, le competenze e l'insegnante");
    await dialog.getByRole("button", { name: "Sì, rendi pubblico" }).click();

    await expect(share.getByRole("switch", { name: "Link pubblico attivo" })).toBeChecked();
    expect(fake.table("course_certificates")[0]).toMatchObject({ shared_by: parent.id, shared_as: "parent" });

    const linkedin = new URL((await share.getByRole("link", { name: "Aggiungi a LinkedIn" }).getAttribute("href"))!);
    expect(linkedin.origin + linkedin.pathname).toBe("https://www.linkedin.com/profile/add");
    expect(linkedin.searchParams.get("name")).toBe("Python Base");
    expect(linkedin.searchParams.get("certUrl")).toBe("https://techlanditalia.it/attestato/TL-2026-7K3QF");
    await expect(share.getByRole("link", { name: "Apri la pagina pubblica" }))
      .toHaveAttribute("href", "https://techlanditalia.it/attestato/TL-2026-7K3QF");

    // Immagine 1080x1350 da pubblicare su Instagram
    const downloadPromise = page.waitForEvent("download");
    await share.getByRole("button", { name: "Immagine per Instagram" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("Attestato-Luca-Bianchi-Python-Base.png");
    const png = await readFile((await download.path())!);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1080, 1350]);
    if (process.env.CERT_IMAGE_OUT) await download.saveAs(process.env.CERT_IMAGE_OUT);
    await expect(page.getByText("Immagine scaricata", { exact: true })).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

    // Si torna privato con un tocco
    await share.getByText("Link pubblico attivo").click();
    await expect(share.getByRole("switch", { name: "Condividi su LinkedIn o Instagram" })).not.toBeChecked();
    expect(fake.table("course_certificates")[0]).toMatchObject({ shared_at: null, shared_as: null });
  });

  test("sul telefono l'immagine va nel pannello di condivisione", async ({ page, fake }) => {
    fake.seed("course_certificates", [{ ...privateCert, shared_at: "2026-10-16T18:00:00Z", shared_by: parent.id, shared_as: "parent" }]);
    await page.addInitScript(() => {
      const w = window as unknown as { shared?: { name: string; size: number; text?: string } };
      Object.defineProperty(navigator, "canShare", { value: (d: ShareData) => !!d.files?.length });
      Object.defineProperty(navigator, "share", {
        value: async (d: ShareData) => {
          w.shared = { name: d.files![0].name, size: d.files![0].size, text: d.text };
        },
      });
    });
    await fake.signInBeforeLoad(page, parent);
    await page.goto("/area-riservata#certificazioni");

    const share = page.getByTestId("parent-certificates").getByTestId("certificate-share");
    await share.getByRole("button", { name: "Immagine per Instagram" }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { shared?: { name: string } }).shared?.name))
      .toBe("Attestato-Luca-Bianchi-Python-Base.png");
    const shared = await page.evaluate(() => (window as unknown as { shared: { size: number; text: string } }).shared);
    expect(shared.size).toBeGreaterThan(50_000);
    expect(shared.text).toBe("Ho completato il corso Python Base con TECHLAND! https://techlanditalia.it/attestato/TL-2026-7K3QF");
  });

  test("l'alunno con 15 anni lo rende pubblico da solo, con 10 chiede al genitore", async ({ page, fake }) => {
    fake.seed("course_certificates", [privateCert]);
    fake.seed("student_birth_years", [{ student_id: student.id, birth_year: 2011 }]);
    fakeSharing(fake);
    await fake.signInBeforeLoad(page, student);
    await page.goto("/area-riservata");
    await page.getByText("Tocca per continuare").click();

    const share = page.getByTestId("student-certificates").getByTestId("certificate-share");
    await share.getByText("Condividi su LinkedIn o Instagram").click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Rendere pubblico il tuo attestato?");
    await expect(dialog).toContainText("vedrà il tuo nome e cognome");
    await dialog.getByRole("button", { name: "Sì, rendi pubblico" }).click();
    await expect(share.getByRole("link", { name: "Aggiungi a LinkedIn" })).toBeVisible();
    expect(fake.table("course_certificates")[0]).toMatchObject({ shared_by: student.id, shared_as: "student" });

    // Con 10 anni lo decide il genitore
    fake.table("student_birth_years")[0].birth_year = 2016;
    Object.assign(fake.table("course_certificates")[0], { shared_at: null, shared_by: null, shared_as: null });
    await page.reload();
    await expect(share.getByText("chiedi a un genitore di attivarlo dalla sua area", { exact: false })).toBeVisible();
    await expect(share.getByRole("switch")).toHaveCount(0);
  });

  test("chi inquadra il QR di un attestato pubblico vede l'attestato completo", async ({ page, fake }) => {
    const codes = fakeVerify(fake, verifiedPublic);
    await page.goto("/attestato/tl-2026-7k3qf");

    const verified = page.getByTestId("certificate-verified");
    await expect(verified.getByRole("heading", { name: "Attestato autentico" })).toBeVisible();
    expect(codes).toEqual(["TL-2026-7K3QF"]);
    await expect(verified.getByText("Luca Bianchi", { exact: true })).toBeVisible();
    await expect(verified.getByText("🐍 Python Base")).toBeVisible();
    await expect(verified.getByText("32 lezioni · 320 ore di coding")).toBeVisible();
    await expect(verified.getByText("Marco Verdi")).toBeVisible();
    await expect(verified.getByText("Variabili, condizioni e cicli")).toBeVisible();
    await expect(verified.getByText("Perseveranza")).toBeVisible();
    const preview = verified.getByRole("img", { name: "Attestato di Luca Bianchi: Python Base" });
    await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(page).toHaveTitle(/Attestato di Luca Bianchi: Python Base/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("link", { name: "Scopri i corsi TECHLAND" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  });

  test("un attestato privato mostra solo le iniziali", async ({ page, fake }) => {
    fakeVerify(fake, verifiedPrivate);
    await page.goto("/attestato/TL-2026-7K3QF");

    const verified = page.getByTestId("certificate-verified");
    await expect(verified.getByRole("heading", { name: "Attestato autentico" })).toBeVisible();
    await expect(verified.getByText("Iniziali dello studente")).toBeVisible();
    await expect(verified.getByText("L. B.", { exact: true })).toBeVisible();
    await expect(verified.getByText("Per proteggere i dati dei ragazzi mostriamo solo le iniziali", { exact: false })).toBeVisible();
    await expect(verified.getByText("Luca Bianchi")).toHaveCount(0);
    await expect(verified.getByText("Marco Verdi")).toHaveCount(0);
    await expect(verified.getByRole("img")).toHaveCount(0);
  });

  test("dal modulo si verifica un codice scritto a mano; un codice sbagliato non è valido", async ({ page, fake }) => {
    fakeVerify(fake, verifiedPrivate);
    await page.goto("/attestato/TL-2026-ZZZZZ");
    await expect(page.getByRole("heading", { name: "Nessun attestato con questo codice" })).toBeVisible();

    await page.goto("/attestato");
    await expect(page.getByRole("heading", { name: "Verifica un attestato" })).toBeVisible();
    await page.getByLabel("Codice dell'attestato").fill("<nope>");
    await page.getByRole("button", { name: "Verifica" }).click();
    await expect(page.getByText("Questo non sembra un codice", { exact: false })).toBeVisible();

    await page.getByLabel("Codice dell'attestato").fill("tl 2026 7k3qf");
    await page.getByRole("button", { name: "Verifica" }).click();
    await expect(page).toHaveURL(/\/attestato\/TL-2026-7K3QF$/);
    await expect(page.getByRole("heading", { name: "Attestato autentico" })).toBeVisible();
  });
});
