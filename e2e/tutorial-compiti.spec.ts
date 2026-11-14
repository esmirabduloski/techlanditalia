import { test, expect } from "./support/test";
import { course, seedStudent, student } from "./support/seed";
import { FAKE_SUPABASE_URL, type FakeUser } from "./support/fakeSupabase";

/**
 * Tutorial "come consegnare i compiti" per corso (Admin → Corsi → Contenuto).
 * Lo studente lo apre dalla card del corso nella home: video in alto, guida PDF
 * sotto mostrata pagina per pagina (non scaricata).
 */

const admin: FakeUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "admin@techland.test",
  password: "password-di-prova",
  fullName: "Admin Techland",
};

const PDF_PATH = `${course.id}/guida-1.pdf`;
const tutorialButton = (page: import("@playwright/test").Page) =>
  page.getByRole("link", { name: "Tutorial: come consegnare i compiti" });

/** PDF minimo e valido con `pages` pagine (A4), con il numero di pagina scritto sopra. */
function tinyPdf(pages: number): Buffer {
  const objects: string[] = [];
  const kids = Array.from({ length: pages }, (_, i) => `${4 + i * 2} 0 R`).join(" ");
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  for (let i = 0; i < pages; i++) {
    const stream = `BT /F1 48 Tf 72 700 Td (Pagina ${i + 1}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

test.beforeEach(async ({ page }) => {
  // Niente rete vera per il player YouTube
  await page.route("https://www.youtube-nocookie.com/**", (route) => route.fulfill({ status: 200, body: "<html></html>" }));
});

test("lo studente apre il tutorial dalla card: video in alto e PDF pagina per pagina", async ({ page, fake }) => {
  seedStudent(fake);
  fake.seed("course_homework_tutorials", [
    { course_id: course.id, video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", video_path: null, pdf_path: PDF_PATH },
  ]);
  fake.storageObjects.add(`course-tutorials/${PDF_PATH}`);
  await fake.signInBeforeLoad(page, student);
  // Il link firmato del PDF restituisce un PDF vero di 2 pagine
  await page.route(`${FAKE_SUPABASE_URL}/storage/v1/object/sign/course-tutorials/**`, (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, headers: { "content-type": "application/pdf", "access-control-allow-origin": "*" }, body: tinyPdf(2) })
      : route.fallback(),
  );

  await page.goto("/area-riservata");
  await expect(tutorialButton(page)).toBeVisible();
  await tutorialButton(page).click();

  await expect(page).toHaveURL(new RegExp(`/area-riservata/corso/${course.id}/tutorial-compiti$`));
  await expect(page.getByRole("heading", { name: "Come consegnare i compiti" })).toBeVisible();
  await expect(page.getByTitle("Video: come consegnare i compiti")).toHaveAttribute(
    "src", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");

  // Le pagine del PDF sono disegnate nella pagina, una sotto l'altra
  await expect(page.getByRole("img", { name: "Pagina 1 di 2" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Pagina 2 di 2")).toBeVisible();
  const drawn = await page.getByRole("img", { name: "Pagina 1 di 2" }).evaluate((c: HTMLCanvasElement) => c.width > 0 && c.height > c.width);
  expect(drawn).toBe(true);

  // Il video è sopra la guida
  const videoBox = await page.getByTitle("Video: come consegnare i compiti").boundingBox();
  const pdfBox = await page.getByRole("img", { name: "Pagina 1 di 2" }).boundingBox();
  expect(videoBox!.y).toBeLessThan(pdfBox!.y);

  await page.getByRole("button", { name: "Indietro alla home" }).click();
  await expect(page).toHaveURL(/\/area-riservata$/);
});

test("senza tutorial il bottone nella card non c'è", async ({ page, fake }) => {
  seedStudent(fake);
  await fake.signInBeforeLoad(page, student);
  await page.goto("/area-riservata");
  await expect(page.getByText("Apri lezioni e compiti").first()).toBeVisible();
  await expect(tutorialButton(page)).toHaveCount(0);
});

test("l'admin salva link del video e PDF del corso, e li toglie", async ({ page, fake }) => {
  fake.addUser(admin);
  fake.seed("profiles", [{ id: admin.id, full_name: admin.fullName, role: "admin", email: admin.email }]);
  fake.seed("user_roles", [{ user_id: admin.id, role: "admin" }]);
  fake.seed("courses", [course]);
  await fake.signInBeforeLoad(page, admin);
  await page.goto(`/admin/corsi/${course.id}/contenuto`);

  const card = page.locator("div.rounded-lg", { has: page.getByText("Tutorial: come consegnare i compiti", { exact: true }) }).first();
  await expect(card).toBeVisible();

  // Un link che non è YouTube/Vimeo non si salva
  await card.getByLabel("Link del video").fill("https://example.test/video.mp4");
  await expect(card.getByText(/Incolla un link di YouTube o Vimeo/)).toBeVisible();
  await expect(card.getByRole("button", { name: "Salva tutorial" })).toBeDisabled();

  await card.getByLabel("Link del video").fill("https://youtu.be/dQw4w9WgXcQ");
  await expect(card.getByTitle("Anteprima video")).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  await page.getByTestId("tutorial-pdf-input").setInputFiles({ name: "Guida consegna.pdf", mimeType: "application/pdf", buffer: tinyPdf(1) });
  await expect(page.getByText("Guida consegna.pdf caricato: ricordati di salvare")).toBeVisible();

  await card.getByRole("button", { name: "Salva tutorial" }).click();
  await expect(page.getByText("Tutorial salvato: gli studenti del corso lo vedono nella home")).toBeVisible();
  const [row] = fake.table("course_homework_tutorials");
  expect(row).toMatchObject({ course_id: course.id, video_url: "https://youtu.be/dQw4w9WgXcQ", video_path: null });
  expect(row.pdf_path).toMatch(new RegExp(`^${course.id}/guida-\\d+\\.pdf$`));
  expect(fake.storageObjects.has(`course-tutorials/${row.pdf_path}`)).toBe(true);
  await expect(card.getByRole("link", { name: "Vedi come lo vede lo studente" })).toHaveAttribute(
    "href", `/area-riservata/corso/${course.id}/tutorial-compiti`);

  // Togliendo video e PDF il tutorial sparisce e il file viene cancellato
  await card.getByLabel("Link del video").fill("");
  await card.getByRole("button", { name: "Togli" }).click();
  await card.getByRole("button", { name: "Salva tutorial" }).click();
  await expect(page.getByText("Tutorial tolto: gli studenti non vedono più il bottone")).toBeVisible();
  expect(fake.table("course_homework_tutorials")).toEqual([]);
  await expect.poll(() => fake.storageObjects.has(`course-tutorials/${row.pdf_path}`)).toBe(false);
});
