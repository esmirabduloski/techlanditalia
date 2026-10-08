import { describe, expect, it } from "vitest";
import { csvCell } from "./csv";

describe("csvCell", () => {
  it("racchiude il valore tra virgolette e raddoppia quelle interne", () => {
    expect(csvCell("Mario")).toBe('"Mario"');
    expect(csvCell('Corso "Python"')).toBe('"Corso ""Python"""');
    expect(csvCell("a,b\nc")).toBe('"a,b\nc"');
  });

  it("valori vuoti e non stringa", () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
    expect(csvCell(42)).toBe('"42"');
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
  });

  it("neutralizza le formule (CSV injection) aprendo il file in Excel", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell("+39 333")).toBe('"\'+39 333"');
    expect(csvCell("-10")).toBe('"\'-10"');
    expect(csvCell("@SUM(A1)")).toBe('"\'@SUM(A1)"');
    expect(csvCell("\tx")).toBe('"\'\tx"');
  });
});
