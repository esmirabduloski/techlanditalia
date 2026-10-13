import { describe, expect, it } from "vitest";
import { lowBalanceMessage } from "./lessonbalance.ts";

describe("lowBalanceMessage", () => {
  it("saldo a 3 con gruppo e genitore", () => {
    expect(lowBalanceMessage({ studentName: "Luca Bianchi", balance: 3, parentName: "Maria Rossi", groupTitle: "Python Junior" }))
      .toEqual({
        title: "📉 Luca Bianchi: restano 3 lezioni",
        body: "Pacchetto quasi finito (Python Junior · genitore Maria Rossi). Proponi il rinnovo alla famiglia.",
      });
  });

  it("singolare e saldo esaurito", () => {
    expect(lowBalanceMessage({ studentName: "Luca", balance: 1 }).title).toBe("📉 Luca: resta 1 lezione");
    expect(lowBalanceMessage({ studentName: "Luca", balance: 0 })).toEqual({
      title: "📉 Luca ha finito le lezioni",
      body: "Pacchetto esaurito. Proponi il rinnovo alla famiglia.",
    });
  });
});
