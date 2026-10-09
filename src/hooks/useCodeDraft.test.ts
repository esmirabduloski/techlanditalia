// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Supabase simulato: una tabella student_code_drafts in memoria ---------
type Row = Record<string, string>;
const db = vi.hoisted(() => ({
  rows: [] as Row[],
  upserts: [] as { payload: Row; onConflict: string }[],
  selects: [] as Row[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const from = () => {
    const filters: Row = {};
    const chain = {
      select: () => chain,
      eq: (col: string, val: string) => {
        filters[col] = val;
        return chain;
      },
      maybeSingle: async () => {
        db.selects.push({ ...filters });
        const row = db.rows.find((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
        return { data: row ? { content: row.content, updated_at: new Date().toISOString() } : null, error: null };
      },
      upsert: async (payload: Row, opts: { onConflict: string }) => {
        db.upserts.push({ payload, onConflict: opts.onConflict });
        const keys = opts.onConflict.split(",");
        const existing = db.rows.find((r) => keys.every((k) => r[k] === payload[k]));
        if (existing) Object.assign(existing, payload);
        else db.rows.push({ ...payload });
        return { error: null };
      },
    };
    return chain;
  };
  return { supabase: { from } };
});

// Come il vero useAuth: lo stesso oggetto utente a ogni render
const auth = vi.hoisted(() => ({ user: { id: "studente-1" } }));
vi.mock("./useAuth", () => ({ useAuth: () => auth }));
vi.mock("./use-toast", () => ({ useToast: () => ({ toast: () => undefined }) }));

import { flushCodeDrafts } from "@/lib/codeDrafts";
import { useCodeDraft } from "./useCodeDraft";

const HW = "11111111-2222-4333-8444-555555555555";
const DEFAULT = "import turtle\n";

async function renderDraft(taskId = `homework-${HW}`) {
  const hook = renderHook(() => useCodeDraft({ taskId, codeType: "python", defaultCode: DEFAULT }));
  // attende il caricamento della bozza (solo promesse, nessun timer)
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
  return hook;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  db.rows = [];
  db.upserts = [];
  db.selects = [];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useCodeDraft", () => {
  it("compiti: legge e salva nella colonna homework_id (prima finiva in task_id e veniva rifiutato)", async () => {
    db.rows.push({ student_id: "studente-1", homework_id: HW, code_type: "python", content: "t.forward(50)" });
    const { result } = await renderDraft();
    expect(db.selects[0]).toMatchObject({ student_id: "studente-1", homework_id: HW, code_type: "python" });
    expect(result.current.code).toBe("t.forward(50)");

    act(() => result.current.setCode("t.forward(80)"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(db.upserts.at(-1)).toEqual({
      payload: { student_id: "studente-1", homework_id: HW, code_type: "python", content: "t.forward(80)" },
      onConflict: "student_id,homework_id,code_type",
    });
  });

  it("task di lezione: colonna task_id", async () => {
    const { result } = await renderDraft("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    act(() => result.current.setCode("print(1)"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(db.upserts.at(-1)?.payload).toMatchObject({ task_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" });
    expect(db.upserts.at(-1)?.onConflict).toBe("student_id,task_id,code_type");
  });

  it("uscendo dall'esercizio prima dei 3 secondi il codice viene salvato lo stesso", async () => {
    const { result, unmount } = await renderDraft();
    act(() => result.current.setCode("t.circle(40)"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // autosave non ancora partito
    });
    expect(db.upserts).toHaveLength(0);
    await act(async () => {
      unmount();
    });
    expect(db.rows.find((r) => r.homework_id === HW)?.content).toBe("t.circle(40)");
  });

  it("INVIA: flushCodeDrafts salva subito le modifiche in sospeso", async () => {
    const { result } = await renderDraft();
    act(() => result.current.setCode("t.left(90)"));
    await act(async () => {
      await flushCodeDrafts();
    });
    expect(db.rows.find((r) => r.homework_id === HW)?.content).toBe("t.left(90)");
  });

  it("nessun salvataggio se il codice non è cambiato", async () => {
    const { unmount } = await renderDraft();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
      await flushCodeDrafts();
      unmount();
    });
    expect(db.upserts).toHaveLength(0);
  });

  it("Ripristina dopo un salvataggio: viene salvato il codice iniziale", async () => {
    db.rows.push({ student_id: "studente-1", homework_id: HW, code_type: "python", content: "vecchio" });
    const { result } = await renderDraft();
    act(() => result.current.resetCode());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(db.rows.find((r) => r.homework_id === HW)?.content).toBe(DEFAULT);
  });
});
