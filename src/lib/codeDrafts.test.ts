import { describe, expect, it } from "vitest";
import { draftConflictTarget, draftTarget } from "./codeDrafts";

describe("draftTarget", () => {
  it("task di una lezione: colonna task_id", () => {
    const t = draftTarget("6f1c2a52-1111-4222-8333-444455556666");
    expect(t).toEqual({ column: "task_id", id: "6f1c2a52-1111-4222-8333-444455556666" });
    expect(draftConflictTarget(t)).toBe("student_id,task_id,code_type");
  });

  it("compito: colonna homework_id con l'id senza prefisso", () => {
    const t = draftTarget("homework-6f1c2a52-1111-4222-8333-444455556666");
    expect(t).toEqual({ column: "homework_id", id: "6f1c2a52-1111-4222-8333-444455556666" });
    expect(draftConflictTarget(t)).toBe("student_id,homework_id,code_type");
  });
});
