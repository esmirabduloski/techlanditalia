import { describe, expect, it } from "vitest";
import { buildCsv, csvCell, decodeCsvBytes, parseCsv, uncsvCell } from "./csv";

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

describe("parseCsv", () => {
  it("rilegge quello che buildCsv scrive, formule comprese", () => {
    const rows = [["Mario", 'Corso "Python"', "a;b\nc", "=SOMMA(A1)", ""], ["-10", "@x", "", "", "fine"]];
    const parsed = parseCsv(buildCsv(["A", "B", "C", "D", "E"], rows));
    expect(parsed[0]).toEqual(["A", "B", "C", "D", "E"]);
    expect(parsed.slice(1).map((r) => r.map(uncsvCell))).toEqual(rows);
  });

  it("riconosce il separatore dall'intestazione", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a;b\r\n1;2,5")).toEqual([["a", "b"], ["1", "2,5"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
    // Le virgole tra virgolette nell'intestazione non contano
    expect(parseCsv('"x,y";z\n1;2')).toEqual([["x,y", "z"], ["1", "2"]]);
  });

  it("toglie il BOM e accetta righe CR, CRLF e senza a capo finale", () => {
    expect(parseCsv("\ufeffa;b\r1;2\r\n3;4")).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
    expect(parseCsv("a;b\n1;2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("celle vuote e righe corte", () => {
    expect(parseCsv("a;b;c\n;;\n1")).toEqual([["a", "b", "c"], ["", "", ""], ["1"]]);
  });
});

describe("uncsvCell", () => {
  it("toglie l'apice solo davanti a una formula", () => {
    expect(uncsvCell("'=1+1")).toBe("=1+1");
    expect(uncsvCell("'-10")).toBe("-10");
    expect(uncsvCell("l'amico")).toBe("l'amico");
    expect(uncsvCell("'ciao")).toBe("'ciao");
  });
});

describe("decodeCsvBytes", () => {
  it("UTF-8 se valido, altrimenti Windows-1252 (CSV di Excel su Windows)", () => {
    expect(decodeCsvBytes(new TextEncoder().encode("Nicolò"))).toBe("Nicolò");
    expect(decodeCsvBytes(new Uint8Array([0x4e, 0x69, 0x63, 0x6f, 0x6c, 0xf2]))).toBe("Nicolò");
  });
});
