import { test, expect } from "./support/test";
import type { FakeUser } from "./support/fakeSupabase";
import { emailCatalog } from "../supabase/functions/_shared/emailcatalog.ts";

/**
 * Admin → Email: catalogo con anteprima ed email di prova, invii previsti e
 * storico delle email inviate (registro email_log). Il catalogo è quello vero
 * della edge function admin-email-center, con i suoi esempi.
 */

const admin: FakeUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "admin@techland.test",
  password: "password-di-prova",
  fullName: "Admin Techland",
};
const parentId = "44444444-4444-4444-8444-444444444444";

test.beforeEach(async ({ fake, page }) => {
  fake.addUser(admin);
  fake.seed("profiles", [
    { id: admin.id, full_name: admin.fullName, role: "admin" },
    { id: parentId, full_name: "Anna Rossi", role: "parent" },
  ]);
  fake.seed("user_roles", [{ user_id: admin.id, role: "admin" }]);
  fake.seed("email_log", [
    {
      kind: "pause_ending", to_email: "anna@example.com", recipient_id: parentId, lead_id: null,
      subject: "⏯️ La pausa di Luca finisce tra una settimana", html: "<p>Dal 09/11/2026 riprendono le lezioni di Luca.</p>",
      status: "sent", error: null, provider_id: "re_1", source: "subscription-pause-check",
      created_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
    },
    {
      kind: "password_reset", to_email: "anna@example.com", recipient_id: parentId, lead_id: null,
      subject: "🔐 Reimposta la tua password - TECHLAND", html: null,
      status: "sent", error: null, provider_id: "re_2", source: "send-password-reset-email",
      created_at: new Date(Date.now() - 5 * 3600_000).toISOString(),
    },
    {
      kind: "payment_overdue", to_email: "mario@example.com", recipient_id: null, lead_id: null,
      subject: "Pagamento da saldare – 89,00 €", html: "<p>rata</p>",
      status: "failed", error: "Resend 422: indirizzo non valido", provider_id: null, source: "send-payment-reminders",
      created_at: new Date(Date.now() - 26 * 3600_000).toISOString(),
    },
  ]);
  const entries = emailCatalog("https://techlanditalia.it").map(({ storeBody, ...e }) => ({
    ...e,
    sensitive: !storeBody,
    sent30d: e.kind === "pause_ending" ? 4 : 0,
    failed30d: e.kind === "payment_overdue" ? 1 : 0,
  }));
  fake.fn("admin-email-center", (body) => {
    const b = body as { action: string; kind?: string };
    if (b.action === "catalog") return { body: { entries, logReady: true } };
    if (b.action === "upcoming") {
      return {
        body: {
          days: 30,
          items: [
            {
              kind: "pause_ending", label: "Fine pausa in arrivo", scheduledFor: "2030-10-26T07:00:00.000Z",
              recipientName: "Anna Rossi", recipientEmail: "anna@example.com", studentName: "Luca Rossi",
              channel: "push_email", description: "Le lezioni riprendono il 09/11/2030 (avviso a 14 giorni)",
            },
            {
              kind: "payment_reminder", label: "Promemoria pagamento", scheduledFor: "2030-11-02T07:00:00.000Z",
              recipientName: "Mario Bianchi", recipientEmail: null, studentName: null,
              channel: "none", description: "La rata 3/10 di 89,00 € in scadenza il 05/11",
            },
          ],
        },
      };
    }
    if (b.action === "test") return { body: { ok: true, to: admin.email } };
    return { status: 400, body: { error: "Richiesta non valida" } };
  });
  await fake.signInBeforeLoad(page, admin);
});

test("catalogo: anteprima d'esempio ed email di prova all'admin", async ({ page, fake }) => {
  await page.goto("/admin/email");
  await expect(page.getByRole("heading", { name: "Email", level: 1 })).toBeVisible();
  await expect(page.getByText("Non inviate negli ultimi 30 giorni").locator("..").locator("..")).toContainText("1");

  const card = page.getByTestId("catalog-payment_overdue");
  await expect(card).toContainText("Sollecito rata scaduta");
  await expect(card).toContainText("Oggetto: Pagamento da saldare");
  await card.getByRole("button", { name: "Anteprima" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Esempio con dati finti");
  const frame = page.frameLocator('iframe[title="Anteprima: Sollecito rata scaduta"]');
  await expect(frame.getByText("Causale:")).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page.getByTestId("catalog-password_reset")).toContainText("Corpo non salvato");
  await expect(page.getByTestId("catalog-trustpilot_invite").getByRole("button", { name: "Inviami una prova" })).toHaveCount(0);

  await page.getByTestId("catalog-pause_ending").getByRole("button", { name: "Inviami una prova" }).click();
  await expect(page.getByText(`Email di prova inviata a ${admin.email}`)).toBeVisible();
  expect(fake.callsTo("admin-email-center").map((c) => c.body)).toContainEqual({ action: "test", kind: "pause_ending" });
});

test("programmate: invii previsti per giorno con il canale", async ({ page }) => {
  await page.goto("/admin/email?tab=programmate");
  const items = page.getByTestId("upcoming-item");
  await expect(items).toHaveCount(2);
  await expect(page.getByRole("heading", { name: /sabato 26 ottobre 2030/i })).toBeVisible();
  await expect(items.first()).toContainText("Fine pausa in arrivo");
  await expect(items.first()).toContainText("Push + email");
  await expect(items.first()).toContainText("studente: Luca Rossi");
  await expect(items.nth(1)).toContainText("Nessun canale");
});

test("inviate: storico con destinatari, corpo, email di sicurezza e filtri", async ({ page }) => {
  await page.goto("/admin/email?tab=inviate");
  const rows = page.getByTestId("sent-item");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("Anna Rossi · anna@example.com");

  await rows.first().click();
  await expect(page.frameLocator('iframe[title^="Anteprima:"]').getByText("riprendono le lezioni di Luca")).toBeVisible();
  await page.keyboard.press("Escape");

  await rows.nth(1).click();
  await expect(page.getByRole("dialog")).toContainText("Contenuto non salvato");
  await page.keyboard.press("Escape");

  await rows.nth(2).click();
  await expect(page.getByRole("dialog")).toContainText("Non inviata: Resend 422: indirizzo non valido");
  await page.keyboard.press("Escape");

  await page.getByRole("combobox", { name: "Esito" }).click();
  await page.getByRole("option", { name: "Non inviate" }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("mario@example.com");

  await page.getByRole("combobox", { name: "Esito" }).click();
  await page.getByRole("option", { name: "Tutti gli esiti" }).click();
  await page.getByRole("textbox", { name: "Cerca destinatario" }).fill("anna@example.com");
  await page.getByRole("button", { name: "Cerca" }).click();
  await expect(rows).toHaveCount(2);
});
