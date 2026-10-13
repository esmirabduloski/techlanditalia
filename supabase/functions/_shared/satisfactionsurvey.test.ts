import { describe, expect, it } from "vitest";
import {
  DEFAULT_RULES,
  cleanComment,
  isExpired,
  isValidScore,
  lowScoreLabel,
  parseRules,
  planSurvey,
  referralLink,
  scoreOutcome,
  surveyInviteMessage,
  thankYouMessage,
} from "./satisfactionsurvey.ts";

describe("parseRules", () => {
  it("valori mancanti o non validi tornano ai default", () => {
    expect(parseRules(null)).toEqual(DEFAULT_RULES);
    expect(parseRules({ satisfied_min: "x", cooldown_days: "" })).toEqual(DEFAULT_RULES);
  });

  it("limita i voti tra 0 e 10", () => {
    const r = parseRules({ satisfied_min: 15, trustpilot_min: -3, low_max: 4, enabled: false });
    expect(r.satisfied_min).toBe(10);
    expect(r.trustpilot_min).toBe(0);
    expect(r.low_max).toBe(4);
    expect(r.enabled).toBe(false);
  });
});

describe("planSurvey", () => {
  const now = new Date("2026-10-13T16:00:00Z");

  it("manda se non ci sono sondaggi recenti", () => {
    expect(planSurvey({ paused: false, lastSentAt: null, now, rules: DEFAULT_RULES })).toEqual({ action: "send" });
    expect(planSurvey({ paused: false, lastSentAt: "2026-09-28T16:00:00Z", now, rules: DEFAULT_RULES }))
      .toEqual({ action: "send" });
  });

  it("salta se ne è partito uno da poco o lo studente è in pausa", () => {
    expect(planSurvey({ paused: false, lastSentAt: "2026-10-01T16:00:00Z", now, rules: DEFAULT_RULES }).action)
      .toBe("skip");
    expect(planSurvey({ paused: true, lastSentAt: null, now, rules: DEFAULT_RULES }))
      .toEqual({ action: "skip", reason: "studente in pausa" });
  });
});

describe("isExpired", () => {
  const now = new Date("2026-10-22T00:00:00Z");
  it("scade dopo expire_days", () => {
    expect(isExpired("2026-10-01T00:00:00Z", now, DEFAULT_RULES)).toBe(true);
    expect(isExpired("2026-10-02T00:00:01Z", now, DEFAULT_RULES)).toBe(false);
    expect(isExpired(null, now, DEFAULT_RULES)).toBe(false);
  });
});

describe("scoreOutcome", () => {
  it("9-10 soddisfatti: Trustpilot e referral", () => {
    expect(scoreOutcome(9, DEFAULT_RULES)).toEqual({ satisfied: true, trustpilot: true, referral: true, followUp: false });
  });

  it("7-8 neutrali: niente inviti, niente chiamata", () => {
    expect(scoreOutcome(8, DEFAULT_RULES)).toEqual({ satisfied: false, trustpilot: false, referral: false, followUp: false });
  });

  it("0-6 insoddisfatti: chiamata", () => {
    expect(scoreOutcome(6, DEFAULT_RULES).followUp).toBe(true);
  });

  it("trustpilot_min 0 invita tutti", () => {
    expect(scoreOutcome(3, { ...DEFAULT_RULES, trustpilot_min: 0 }).trustpilot).toBe(true);
  });
});

describe("input", () => {
  it("accetta solo voti interi 0-10", () => {
    expect(isValidScore(0)).toBe(true);
    expect(isValidScore(10)).toBe(true);
    expect(isValidScore(11)).toBe(false);
    expect(isValidScore(7.5)).toBe(false);
    expect(isValidScore("9")).toBe(false);
  });

  it("commento ripulito e limitato", () => {
    expect(cleanComment("  ")).toBeNull();
    expect(cleanComment(42)).toBeNull();
    expect(cleanComment(" bello ")).toBe("bello");
    expect(cleanComment("a".repeat(3000))).toHaveLength(2000);
  });
});

describe("testi", () => {
  it("link referral", () => {
    expect(referralLink("https://techlanditalia.it/", "AB12CD34")).toBe("https://techlanditalia.it/prenota?ref=AB12CD34");
    expect(referralLink("https://techlanditalia.it", null)).toBeNull();
  });

  it("invito dopo tre lezioni e a fine modulo", () => {
    expect(surveyInviteMessage({ studentName: "Luca", kind: "after_3_lessons", moduleTitle: null }).title)
      .toBe("Come stanno andando le lezioni di Luca?");
    expect(surveyInviteMessage({ studentName: "Luca", kind: "module_end", moduleTitle: "Torre nell'Inferno" }).body)
      .toContain("il modulo «Torre nell'Inferno»");
  });

  it("ringraziamento solo con i link previsti", () => {
    const both = thankYouMessage({
      studentName: "Luca",
      trustpilotUrl: "https://tp.test",
      referralLink: "https://site.test/prenota?ref=X",
      rewardText: "Una lezione gratis a testa.",
    });
    expect(both.paragraphs).toHaveLength(3);
    expect(both.text).toContain("https://tp.test");
    expect(both.text).toContain("Una lezione gratis a testa.");

    const none = thankYouMessage({ studentName: "Luca", trustpilotUrl: null, referralLink: null });
    expect(none.paragraphs).toHaveLength(1);
  });

  it("motivo dell'attività CRM", () => {
    expect(lowScoreLabel(4, "after_3_lessons", null)).toBe("Sondaggio: 4/10 dopo le prime lezioni");
    expect(lowScoreLabel(5, "module_end", "Modulo 2")).toBe("Sondaggio: 5/10 a fine modulo (Modulo 2)");
  });
});
