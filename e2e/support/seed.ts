/** Dati di partenza condivisi: un alunno iscritto a Python Base con una lezione, un task e un compito. */
import type { FakeSupabase, FakeUser } from "./fakeSupabase";

export const student: FakeUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "luca123@studenti.techland.test",
  username: "luca123",
  password: "password-di-prova",
  fullName: "Luca Bianchi",
};

export const parent: FakeUser = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "maria.rossi@example.com",
  password: "password-di-prova",
  fullName: "Maria Rossi",
};

export const course = {
  id: "c0000000-0000-4000-8000-000000000001",
  slug: "python-base",
  title: "Python Base",
  emoji: "🐍",
  age_range: "10-14 anni",
  is_visible: true,
  total_lessons: 10,
  level: "base",
  description: "Le basi di Python",
};

export const lesson = {
  id: "a0000000-0000-4000-8000-000000000001",
  course_id: course.id,
  lesson_number: 1,
  title: "Primi passi",
  points_reward: 50,
};

export const codeTask = {
  id: "b0000000-0000-4000-8000-000000000001",
  lesson_id: lesson.id,
  task_number: 1,
  title: "Il tuo primo programma",
  description: "Stampa un saluto",
  content: "<p>Usa <code>print</code> per stampare.</p>",
  content_type: "mixed",
  is_visible: true,
  points_reward: 10,
  default_python_code: 'print("Ciao, mondo!")\n',
  python_env: null,
  attachments: [],
};

export const homework = {
  id: "d0000000-0000-4000-8000-000000000001",
  lesson_id: lesson.id,
  title: "Calcolatrice",
  description: "Somma due numeri",
  instructions: "<p>Scrivi un programma che somma 2 e 3.</p>",
  points_reward: 30,
  due_date: null,
  attachments: [],
  default_python_code: "# scrivi qui\n",
  python_env: null,
  preview_only: false,
  // Risorse annidate già pronte: il fake non fa join (vedi fakeSupabase.ts)
  lessons: { id: lesson.id, title: lesson.title, lesson_number: 1, courses: { id: course.id, title: course.title, emoji: course.emoji, slug: course.slug } },
};

export function seedStudent(fake: FakeSupabase) {
  fake.addUser(student);
  fake.seed("profiles", [{ id: student.id, full_name: student.fullName, total_points: 120, avatar_id: 1 }]);
  fake.seed("courses", [course]);
  fake.seed("enrollments", [
    {
      student_id: student.id,
      course_id: course.id,
      status: "active",
      enrolled_at: "2026-09-01T00:00:00Z",
      course,
    },
  ]);
  fake.seed("lessons", [lesson]);
  fake.seed("lesson_tasks", [codeTask]);
  fake.seed("homework", [homework]);
  fake.rpc("submit_homework_code", submitHomeworkCode);
  fake.rpc("submit_homework_file", submitHomeworkFile);
  return fake;
}

/**
 * Come la RPC submit_homework_code (drizzle/migrations/0039_auto_grading.sql):
 * crea o aggiorna la consegna dell'alunno loggato, rifiuta quelle già valutate
 * e salva il voto proposto solo se il compito ha casi di prova.
 */
function submitHomeworkCode(args: unknown, { fake, userId }: { fake: FakeSupabase; userId: string | null }) {
  const { _homework_id, _notes, _auto_score, _test_results } = args as {
    _homework_id: string; _notes: string; _auto_score?: number | null; _test_results?: unknown;
  };
  if (!userId) return { success: false, error: "not_authenticated" };
  if (!_notes?.trim()) return { success: false, error: "empty" };
  const hw = fake.table("homework").find((h) => h.id === _homework_id);
  const hasTests = Array.isArray(hw?.test_cases) && (hw.test_cases as unknown[]).length > 0;
  const score = hasTests && _auto_score != null ? Math.min(100, Math.max(0, _auto_score)) : null;
  const fields = {
    status: "pending",
    notes: _notes,
    file_type: "text/code",
    auto_score: score,
    test_results: score != null ? (Array.isArray(_test_results) ? _test_results : []) : null,
    submitted_at: new Date().toISOString(),
  };
  const existing = fake.table("homework_submissions").find((s) => s.homework_id === _homework_id && s.student_id === userId);
  if (!existing) {
    fake.seed("homework_submissions", [{ homework_id: _homework_id, student_id: userId, points_earned: 0, ...fields }]);
    return { success: true, created: true };
  }
  if (existing.status === "graded" || existing.status === "approved") return { success: false, error: "already_graded" };
  Object.assign(existing, fields);
  return { success: true, created: false };
}

/**
 * Come la RPC submit_homework_file (drizzle/migrations/0040_submit_homework_file.sql):
 * crea o aggiorna la consegna con file dell'alunno loggato, accetta solo file nella
 * sua cartella, rifiuta le consegne già valutate e azzera il voto proposto.
 */
function submitHomeworkFile(args: unknown, { fake, userId }: { fake: FakeSupabase; userId: string | null }) {
  const { _homework_id, _file_url, _file_name, _file_type, _notes } = args as {
    _homework_id: string; _file_url: string; _file_name: string; _file_type: string; _notes?: string | null;
  };
  if (!userId) return { success: false, error: "not_authenticated" };
  if (!_file_url?.trim() || !_file_name?.trim()) return { success: false, error: "empty" };
  if (!_file_url.startsWith(`${userId}/`) || _file_url.includes("..")) return { success: false, error: "invalid_file" };
  const fields = {
    status: "pending",
    notes: _notes?.trim() || null,
    file_url: _file_url,
    file_name: _file_name,
    file_type: _file_type,
    auto_score: null,
    test_results: null,
    tests_run_at: null,
    submitted_at: new Date().toISOString(),
  };
  const existing = fake.table("homework_submissions").find((s) => s.homework_id === _homework_id && s.student_id === userId);
  if (!existing) {
    fake.seed("homework_submissions", [{ homework_id: _homework_id, student_id: userId, points_earned: 0, ...fields }]);
    return { success: true, created: true };
  }
  if (existing.status === "graded" || existing.status === "approved") return { success: false, error: "already_graded" };
  Object.assign(existing, fields);
  return { success: true, created: false };
}
