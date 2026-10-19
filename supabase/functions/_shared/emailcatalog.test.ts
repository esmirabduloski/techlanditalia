import { describe, expect, it } from "vitest";
import { emailCatalog, emailSample } from "./emailcatalog.ts";
import { EMAIL_KIND_KEYS, EMAIL_KINDS, isEmailKind } from "./emailkinds.ts";
import { brandedEmail, paragraph } from "./emaillayout.ts";
import { bookingEmails, contactStaffEmail, welcomeEmail } from "./emailtemplates.ts";
import { certificateEmail, certificateMessage } from "./certificates.ts";

const SITE = "https://techlanditalia.it";

describe("emailCatalog", () => {
  it("un esempio per ogni tipo, con oggetto e corpo", () => {
    const entries = emailCatalog(`${SITE}/`);
    expect(entries.map((e) => e.kind)).toEqual(EMAIL_KIND_KEYS);
    for (const e of entries) {
      expect(e.sample.subject.trim(), e.kind).not.toBe("");
      expect(e.sample.html.length, e.kind).toBeGreaterThan(40);
      expect(e.label).toBe(EMAIL_KINDS[e.kind].label);
    }
  });

  it("le email con link o codici d'accesso non salvano il corpo", () => {
    const hidden = EMAIL_KIND_KEYS.filter((k) => !EMAIL_KINDS[k].storeBody).sort();
    expect(hidden).toEqual(["newsletter", "newsletter_confirm", "password_reset", "security_mfa_code", "security_mfa_reset", "welcome"]);
  });

  it("gli esempi usano i builder veri", () => {
    const cert = emailSample("certificate_released", SITE);
    expect(cert.subject).toBe("🎓 L'attestato di Luca è pronto");
    expect(cert.html).toContain(`${SITE}/area-riservata#certificazioni`);
    expect(emailSample("payment_overdue", SITE).subject).toBe("Pagamento da saldare – 89,00\u00a0€");
    expect(emailSample("staff_monthly_report", SITE).subject).toBe("📊 Report di settembre 2026 · TECHLAND");
  });

  it("isEmailKind riconosce solo le chiavi del catalogo", () => {
    expect(isEmailKind("pause_ending")).toBe(true);
    expect(isEmailKind("toString")).toBe(false);
    expect(isEmailKind(42)).toBe(false);
  });
});

describe("builder", () => {
  it("escapano i dati inseriti da utenti", () => {
    const evil = "<script>alert(1)</script>";
    const booking = bookingEmails({ parentName: evil, email: "a@b.it", childAge: 9, interest: evil, message: evil });
    expect(booking.staff.html).not.toContain("<script>");
    expect(booking.parent.html).not.toContain("<script>");
    expect(contactStaffEmail({ nome: evil, email: "a@b.it", oggetto: evil, messaggio: evil }).html).not.toContain("<script>");
    expect(welcomeEmail({ fullName: evil, email: "a@b.it", childName: evil, childUsername: evil, setupLink: "" }).html)
      .not.toContain("<script>");
    expect(brandedEmail({ title: evil, bodyHtml: paragraph(evil) })).not.toContain("<script>");
  });

  it("il benvenuto accetta solo link http(s) per la password", () => {
    const html = welcomeEmail({ fullName: "A", email: "a@b.it", childName: "L", childUsername: "l", setupLink: "javascript:alert(1)" }).html;
    expect(html).not.toContain("javascript:");
    expect(html).toContain("Password dimenticata");
  });

  it("l'attestato tiene il saluto come primo paragrafo e il pulsante", () => {
    const msg = certificateMessage({ parentName: "Anna Rossi", studentName: "Luca Rossi", courseTitle: "Python", teacherName: "Marco" });
    const mail = certificateEmail(msg, SITE);
    expect(mail.html).toContain("Ciao Anna,");
    expect(mail.html).toContain("Scarica l'attestato →");
    expect(mail.text).toContain(`${SITE}/area-riservata#certificazioni`);
  });

  it("paragraph rende cliccabili i link solo se richiesto", () => {
    expect(paragraph("vai su https://x.it", { linkify: true })).toContain('<a href="https://x.it"');
    expect(paragraph("vai su https://x.it")).not.toContain("<a ");
  });
});
