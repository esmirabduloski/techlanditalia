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
  return fake;
}
