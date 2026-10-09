// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({ signed: [] as string[], fail: false }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: async (path: string) => {
          storage.signed.push(`${bucket}:${path}`);
          return storage.fail
            ? { data: null, error: new Error("Object not found") }
            : { data: { signedUrl: `https://firmato.example/${bucket}/${path}?token=abc` }, error: null };
        },
      }),
    },
  },
}));

import { getSignedUrl, openStorageFile, storagePathFrom } from "./useSignedUrl";

describe("storagePathFrom", () => {
  it("percorso salvato oggi: invariato", () => {
    expect(storagePathFrom("homework-files", "abc-123/foto-17.png")).toBe("abc-123/foto-17.png");
  });

  it("vecchio URL pubblico del bucket: ne ricava il percorso", () => {
    expect(
      storagePathFrom(
        "homework-files",
        "https://p.supabase.co/storage/v1/object/public/homework-files/abc-123/foto%20mare.png",
      ),
    ).toBe("abc-123/foto mare.png");
  });

  it("URL esterni o di altri bucket: null, si usano così come sono", () => {
    expect(storagePathFrom("homework-files", "https://example.org/foto.png")).toBeNull();
    expect(storagePathFrom("homework-files", "https://p.supabase.co/storage/v1/object/public/altro/x.png")).toBeNull();
  });
});

describe("getSignedUrl", () => {
  beforeEach(() => {
    storage.signed = [];
    storage.fail = false;
  });

  it("firma il percorso, anche quando nel DB c'è il vecchio URL pubblico", async () => {
    await getSignedUrl("homework-files", "abc/foto.png");
    await getSignedUrl("homework-files", "https://p.supabase.co/storage/v1/object/public/homework-files/abc/vecchia.png");
    expect(storage.signed).toEqual(["homework-files:abc/foto.png", "homework-files:abc/vecchia.png"]);
  });

  it("file mancante o senza permessi: null", async () => {
    storage.fail = true;
    expect(await getSignedUrl("homework-files", "abc/foto.png")).toBeNull();
  });
});

describe("openStorageFile (pulsante del docente in Valuta compiti)", () => {
  const tab = { opener: {} as unknown, location: { href: "" }, close: vi.fn() };
  beforeEach(() => {
    storage.signed = [];
    storage.fail = false;
    tab.opener = {};
    tab.location.href = "";
    tab.close.mockClear();
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("apre la scheda subito e poi la porta al link firmato", async () => {
    expect(await openStorageFile("homework-files", "abc/foto.png")).toBe(true);
    expect(window.open).toHaveBeenCalledWith("about:blank", "_blank");
    expect(tab.location.href).toBe("https://firmato.example/homework-files/abc/foto.png?token=abc");
    expect(tab.opener).toBeNull();
  });

  it("se il file non è disponibile chiude la scheda e lo segnala", async () => {
    storage.fail = true;
    expect(await openStorageFile("homework-files", "abc/foto.png")).toBe(false);
    expect(tab.close).toHaveBeenCalled();
  });
});
