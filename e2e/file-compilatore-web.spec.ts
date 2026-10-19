import { test, expect } from "./support/test";
import { course, homework, lesson, seedStudent, student } from "./support/seed";

/**
 * File caricati nel compilatore web: vanno nello spazio privato dello studente
 * (bucket student-web-assets) e l'anteprima li apre con link firmati. Nel
 * codice si usano per nome; i file vecchi con l'URL pubblico continuano a
 * funzionare, anche dopo che l'admin li ha spostati.
 */

const homeworkUrl = `/area-riservata/compito/${homework.id}`;
const legacyUrl = `https://supabase.e2e.test/storage/v1/object/public/web-compiler-assets/${student.id}/vecchio-17-ab.png`;

test.beforeEach(async ({ fake, page }) => {
  await page.route("https://cdn.jsdelivr.net/pyodide/**", (route) => route.abort());
  seedStudent(fake);
  fake.fn("validate-file-upload", () => ({ body: { valid: true } }));
  const webCourse = { ...course, id: "c0000000-0000-4000-8000-000000000002", slug: "web-development", title: "Web Development", emoji: "🌐" };
  Object.assign(fake.table("homework")[0], {
    default_html_code: "<h1>La mia pagina</h1>",
    default_css_code: "",
    default_js_code: "",
    lessons: { id: lesson.id, title: lesson.title, lesson_number: 1, courses: { id: webCourse.id, title: webCourse.title, emoji: webCourse.emoji, slug: webCourse.slug } },
  });
  await fake.signInBeforeLoad(page, student);
});

const preview = (page: import("@playwright/test").Page) => page.frameLocator('iframe[title="Preview"]');

test("l'immagine caricata va nello spazio privato e l'anteprima la apre con un link firmato", async ({ page, fake }) => {
  fake.seed("student_code_drafts", [
    { student_id: student.id, homework_id: homework.id, code_type: "html", content: '<img id="foto" src="gatto.png">' },
  ]);

  await page.goto(homeworkUrl);
  await page.getByTitle("Gestione file").click();
  await page.locator("#file-upload").setInputFiles({
    name: "gatto.png",
    mimeType: "image/png",
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  });
  await expect(page.getByText("Nel codice usalo con il nome gatto.png", { exact: true })).toBeVisible();

  // Caricato nella cartella dello studente del bucket privato, mai in quello pubblico
  const uploads = fake.storageCalls.filter((c) => c.method === "POST" && !c.path.startsWith("object/sign/"));
  expect(uploads).toHaveLength(1);
  expect(uploads[0].path).toMatch(new RegExp(`^object/student-web-assets/${student.id}/gatto-.+\\.png$`));
  expect(fake.storageCalls.some((c) => c.path.includes("web-compiler-assets"))).toBe(false);

  // Nella bozza c'è il percorso privato, non un URL pubblico
  const draft = fake.table("student_code_drafts").find((r) => r.code_type === "web_files");
  const files = JSON.parse(String(draft?.content)).uploadedFiles;
  expect(files).toEqual([{ name: "gatto.png", path: expect.stringMatching(new RegExp(`^${student.id}/gatto-`)), type: "image" }]);

  const img = preview(page).locator("#foto");
  await expect(img).toHaveAttribute("src", new RegExp(`^https://supabase\\.e2e\\.test/storage/v1/object/sign/student-web-assets/${student.id}/gatto-.+\\.png\\?token=finto$`));
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1);
  await expect(page.getByText("I file restano privati.", { exact: false })).toBeVisible();
});

test("file vecchio con l'URL pubblico: dopo lo spostamento si apre con un link firmato", async ({ page, fake }) => {
  fake.storageObjects.add(`student-web-assets/${student.id}/vecchio-17-ab.png`);
  fake.seed("student_code_drafts", [
    { student_id: student.id, homework_id: homework.id, code_type: "html", content: `<img id="foto" src="${legacyUrl}">` },
    { student_id: student.id, homework_id: homework.id, code_type: "web_files", content: JSON.stringify({ uploadedFiles: [{ name: "vecchio.png", url: legacyUrl, type: "image" }], additionalJsFiles: [] }) },
  ]);

  await page.goto(homeworkUrl);
  const img = preview(page).locator("#foto");
  await expect(img).toHaveAttribute("src", `https://supabase.e2e.test/storage/v1/object/sign/student-web-assets/${student.id}/vecchio-17-ab.png?token=finto`);
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1);
});

test("file vecchio non ancora spostato: l'anteprima usa ancora il suo URL", async ({ page, fake }) => {
  fake.storageObjects.add(`web-compiler-assets/${student.id}/vecchio-17-ab.png`);
  fake.seed("student_code_drafts", [
    { student_id: student.id, homework_id: homework.id, code_type: "html", content: `<img id="foto" src="${legacyUrl}">` },
    { student_id: student.id, homework_id: homework.id, code_type: "web_files", content: JSON.stringify({ uploadedFiles: [{ name: "vecchio.png", url: legacyUrl, type: "image" }], additionalJsFiles: [] }) },
  ]);

  await page.goto(homeworkUrl);
  // La firma è stata chiesta (e non trovata) nel bucket privato
  await expect.poll(() => fake.storageCalls.some((c) => c.path === "object/sign/student-web-assets")).toBe(true);
  const img = preview(page).locator("#foto");
  await expect(img).toHaveAttribute("src", legacyUrl);
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1);
});
