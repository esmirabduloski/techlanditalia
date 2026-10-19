import { describe, expect, it } from "vitest";
import { removeUserFiles, USER_FILE_BUCKETS, type StorageLike } from "./userfiles.ts";

const UID = "11111111-1111-4111-8111-111111111111";
const ALTRO = "22222222-2222-4222-8222-222222222222";

/** Storage finto: chiavi "<bucket>/<percorso>", list come l'API (cartelle con id null). */
function fakeStorage(keys: string[], opts: { listFails?: string; removeFails?: string } = {}) {
  const objects = new Set(keys);
  const calls = { removed: [] as string[][] };
  const storage: StorageLike = {
    from: (bucket) => ({
      list: async (prefix = "", options = {}) => {
        if (bucket === opts.listFails) return { data: null, error: { message: "list rotto" } };
        const base = `${bucket}/${prefix}/`;
        const entries = new Map<string, { name: string; id: string | null }>();
        for (const key of [...objects].sort()) {
          if (!key.startsWith(base)) continue;
          const [first, ...more] = key.slice(base.length).split("/");
          entries.set(first, more.length ? { name: first, id: null } : { name: first, id: `id-${key}` });
        }
        const offset = options.offset ?? 0;
        return { data: [...entries.values()].slice(offset, offset + (options.limit ?? 100)), error: null };
      },
      remove: async (paths) => {
        if (bucket === opts.removeFails) return { error: { message: "remove rotto" } };
        calls.removed.push(paths.map((p) => `${bucket}/${p}`));
        for (const p of paths) objects.delete(`${bucket}/${p}`);
        return { error: null };
      },
    }),
  };
  return { storage, objects, calls };
}

describe("removeUserFiles", () => {
  it("cancella la cartella dell'utente in tutti i bucket, sottocartelle comprese", async () => {
    const { storage, objects } = fakeStorage([
      `homework-files/${UID}/compito-1.pdf`,
      `homework-files/${UID}/vecchi/compito-0.png`,
      `student-web-assets/${UID}/gatto-1.png`,
      `web-compiler-assets/${UID}/vecchio-1.png`,
      `homework-files/${ALTRO}/compito-1.pdf`,
      `student-web-assets/${ALTRO}/cane-1.png`,
      "web-compiler-assets/task-attachments/esempio.png",
      `group-certificates/${UID}/attestato.pdf`,
    ]);
    const result = await removeUserFiles(storage, UID);
    expect(result).toEqual({ removed: 4, errors: [] });
    expect([...objects].sort()).toEqual([
      `group-certificates/${UID}/attestato.pdf`,
      `homework-files/${ALTRO}/compito-1.pdf`,
      `student-web-assets/${ALTRO}/cane-1.png`,
      "web-compiler-assets/task-attachments/esempio.png",
    ]);
  });

  it("nessun file: nessuna cancellazione", async () => {
    const { storage, calls } = fakeStorage([`homework-files/${ALTRO}/a.pdf`]);
    expect(await removeUserFiles(storage, UID)).toEqual({ removed: 0, errors: [] });
    expect(calls.removed).toEqual([]);
  });

  it("molti file: elenco a pagine e cancellazione a blocchi", async () => {
    const many = Array.from({ length: 1205 }, (_, i) => `homework-files/${UID}/f${String(i).padStart(4, "0")}.png`);
    const { storage, objects, calls } = fakeStorage(many);
    expect(await removeUserFiles(storage, UID)).toEqual({ removed: 1205, errors: [] });
    expect(objects.size).toBe(0);
    expect(calls.removed.every((batch) => batch.length <= 100)).toBe(true);
  });

  it("un bucket in errore non ferma gli altri", async () => {
    const { storage, objects } = fakeStorage(
      [`homework-files/${UID}/a.pdf`, `student-web-assets/${UID}/b.png`, `web-compiler-assets/${UID}/c.png`],
      { listFails: "homework-files", removeFails: "web-compiler-assets" },
    );
    const result = await removeUserFiles(storage, UID);
    expect(result).toEqual({
      removed: 1,
      errors: ["homework-files: list rotto", "web-compiler-assets: remove rotto"],
    });
    expect(objects.has(`student-web-assets/${UID}/b.png`)).toBe(false);
  });

  it("rifiuta un id che non è un uuid (non tocca mai la radice dei bucket)", async () => {
    const { storage, calls } = fakeStorage(["homework-files/x/a.pdf"]);
    for (const bad of ["", "x", "../", `${UID}/..`]) {
      await expect(removeUserFiles(storage, bad)).rejects.toThrow("id utente non valido");
    }
    expect(calls.removed).toEqual([]);
  });

  it("copre i bucket con una cartella per utente, non gli attestati di gruppo", () => {
    expect([...USER_FILE_BUCKETS]).toEqual(["homework-files", "student-web-assets", "web-compiler-assets"]);
  });
});
