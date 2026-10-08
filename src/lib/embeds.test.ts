// @vitest-environment jsdom
import DOMPurify from "dompurify";
import { describe, expect, it } from "vitest";
import { isAllowedEmbed, restrictEmbeds } from "./embeds";

describe("isAllowedEmbed", () => {
  it("ammette gli strumenti didattici noti, anche nei sottodomini", () => {
    expect(isAllowedEmbed("https://www.youtube-nocookie.com/embed/abc")).toBe(true);
    expect(isAllowedEmbed("https://scratch.mit.edu/projects/1266169747/embed")).toBe(true);
    expect(isAllowedEmbed("https://replit.com/@techland/demo?embed=true")).toBe(true);
    expect(isAllowedEmbed("https://player.vimeo.com/video/1")).toBe(true);
    expect(isAllowedEmbed("https://docs.google.com/presentation/d/x/embed")).toBe(true);
  });

  it("rifiuta domini sconosciuti e trucchi sul nome", () => {
    expect(isAllowedEmbed("https://evil.example/login")).toBe(false);
    expect(isAllowedEmbed("https://youtube.com.evil.example/x")).toBe(false);
    expect(isAllowedEmbed("https://notyoutube.com/x")).toBe(false);
  });

  it("solo https", () => {
    expect(isAllowedEmbed("http://www.youtube.com/embed/abc")).toBe(false);
    expect(isAllowedEmbed("javascript:alert(1)")).toBe(false);
    expect(isAllowedEmbed("")).toBe(false);
    expect(isAllowedEmbed(null)).toBe(false);
  });
});

describe("restrictEmbeds", () => {
  it("lascia invariati i video e i progetti ammessi", () => {
    const html = '<p>Guarda:</p><iframe src="https://www.youtube-nocookie.com/embed/abc" allowfullscreen=""></iframe>';
    expect(restrictEmbeds(html)).toBe(html);
  });

  it("trasforma un iframe sconosciuto in un link, senza perdere il contenuto", () => {
    const out = restrictEmbeds('<iframe src="https://example.org/quiz"></iframe>');
    expect(out).not.toContain("<iframe");
    expect(out).toContain('href="https://example.org/quiz"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain("Apri il contenuto esterno (example.org)");
  });

  it("rimuove gli iframe senza un indirizzo web valido", () => {
    expect(restrictEmbeds('<p>a</p><iframe src="data:text/html,ciao"></iframe>')).toBe("<p>a</p>");
    expect(restrictEmbeds("<p>a</p><iframe></iframe>")).toBe("<p>a</p>");
  });

  it("insieme a DOMPurify, come in lezioni e compiti", () => {
    const dirty =
      '<p onclick="x()">Ciao</p><iframe src="https://evil.example/login"></iframe><script>alert(1)</script>';
    const out = restrictEmbeds(DOMPurify.sanitize(dirty, { ADD_TAGS: ["iframe"] }));
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<iframe");
    expect(out).toContain("evil.example");
  });

  it("HTML senza iframe: restituito così com'è", () => {
    expect(restrictEmbeds("<p>Solo testo</p>")).toBe("<p>Solo testo</p>");
  });
});
