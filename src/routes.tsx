import type { ComponentType } from "react";
import type { RouteRecord } from "vite-react-ssg";
import App from "./App";
import Index from "./pages/Index";

interface PageModule {
  default: ComponentType;
  loader?: (args: unknown) => unknown;
}

// Adapter: le pagine esportano `default` (+ eventuale `loader`), React Router
// data-router si aspetta `Component`/`loader` dal risultato di `lazy()`.
const page = (importer: () => Promise<PageModule>) => async () => {
  const m = await importer();
  return {
    Component: m.default,
    ...(m.loader ? { loader: m.loader } : {}),
  };
};

// Slug corso serviti con contenuto hardcoded (vedi coursesData in CorsoDettaglio):
// unici prerenderabili con contenuto completo. Gli slug DB verranno aggiunti
// dopo il consolidamento del catalogo (SEO_AUDIT_2026.md, SEO-010).
export const PRERENDERED_COURSE_SLUGS = [
  "roblox",
  "roblox-avanzato",
  "web-development",
  "python-base",
  "python-ai",
];

async function fetchPublishedBlogSlugs(): Promise<string[]> {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !apikey) return [];
  try {
    const res = await fetch(
      `${base}/rest/v1/blog_posts?select=slug&published=eq.true`,
      { headers: { apikey } },
    );
    if (!res.ok) return [];
    const rows: { slug: string }[] = await res.json();
    return rows.map((r) => `/blog/${r.slug}`);
  } catch {
    return [];
  }
}

export const routes: RouteRecord[] = [
  {
    path: "/",
    element: <App />,
    children: [
      // === Pagine marketing pubbliche (prerenderate) ===
      { index: true, element: <Index /> },
      { path: "corsi", lazy: page(() => import("./pages/Corsi")) },
      {
        path: "corsi/:id",
        lazy: page(() => import("./pages/CorsoDettaglio")),
        getStaticPaths: () => PRERENDERED_COURSE_SLUGS.map((s) => `/corsi/${s}`),
      },
      { path: "chi-siamo", lazy: page(() => import("./pages/ChiSiamo")) },
      { path: "blog", lazy: page(() => import("./pages/Blog")) },
      {
        path: "blog/:slug",
        lazy: page(() => import("./pages/BlogArticle")),
        getStaticPaths: fetchPublishedBlogSlugs,
      },
      { path: "prenota", lazy: page(() => import("./pages/Prenota")) },
      { path: "faq", lazy: page(() => import("./pages/FAQ")) },
      { path: "privacy", lazy: page(() => import("./pages/Privacy")) },
      { path: "termini", lazy: page(() => import("./pages/Termini")) },
      { path: "cookie", lazy: page(() => import("./pages/Cookie")) },
      { path: "contatti", lazy: page(() => import("./pages/Contatti")) },
      { path: "lavora-con-noi", lazy: page(() => import("./pages/LavoraConNoiGuard")) },
      { path: "accessibilita", lazy: page(() => import("./pages/Accessibilita")) },
      { path: "glossario", lazy: page(() => import("./pages/Glossario")) },

      // === Landing ads (escluse dal prerender: noindex, gestione separata) ===
      { path: "lp/:slug", lazy: page(() => import("./pages/LandingPage")) },

      // === Auth / OAuth (SPA pura) ===
      { path: "auth", lazy: page(() => import("./pages/auth/AuthPage")) },
      { path: ".lovable/oauth/consent", lazy: page(() => import("./pages/OAuthConsent")) },

      // === Area riservata studenti (SPA pura, dietro auth) ===
      { path: "area-riservata", lazy: page(() => import("./pages/area-riservata/Dashboard")) },
      { path: "area-riservata/profilo", lazy: page(() => import("./pages/area-riservata/Profile")) },
      { path: "area-riservata/corso/:courseId", lazy: page(() => import("./pages/area-riservata/CourseProgress")) },
      { path: "area-riservata/corso/:courseId/lezione/:lessonNumber", lazy: page(() => import("./pages/area-riservata/LessonView")) },
      { path: "area-riservata/corso/:courseId/lezione/:lessonNumber/task/:taskNumber", lazy: page(() => import("./pages/area-riservata/TaskView")) },
      { path: "area-riservata/compito/:homeworkId", lazy: page(() => import("./pages/area-riservata/HomeworkView")) },
      { path: "area-riservata/compito-dettaglio/:homeworkId", lazy: page(() => import("./pages/area-riservata/HomeworkDetail")) },
      { path: "area-riservata/acquisti", lazy: page(() => import("./pages/area-riservata/Acquisti")) },
      { path: "area-riservata/classifica", lazy: page(() => import("./pages/area-riservata/Leaderboard")) },

      // === Admin (SPA pura, dietro auth) ===
      { path: "admin/login", lazy: page(() => import("./pages/admin/AdminLogin")) },
      { path: "admin", lazy: page(() => import("./pages/admin/AdminDashboard")) },
      { path: "admin/corsi", lazy: page(() => import("./pages/admin/AdminCourses")) },
      { path: "admin/corsi/:courseId/lezioni", lazy: page(() => import("./pages/admin/AdminLessons")) },
      { path: "admin/corsi/:courseId/contenuto", lazy: page(() => import("./pages/admin/AdminCourseContent")) },
      { path: "admin/corsi/:courseId/lezioni/nuova", lazy: page(() => import("./pages/admin/LessonEditor")) },
      { path: "admin/corsi/:courseId/lezioni/:lessonId/modifica", lazy: page(() => import("./pages/admin/LessonEditor")) },
      { path: "admin/corsi/:courseId/lezioni/:lessonId/task", lazy: page(() => import("./pages/admin/AdminTasks")) },
      { path: "admin/corsi/:courseId/lezioni/:lessonId/task/nuovo", lazy: page(() => import("./pages/admin/TaskEditor")) },
      { path: "admin/corsi/:courseId/lezioni/:lessonId/task/:taskId/modifica", lazy: page(() => import("./pages/admin/TaskEditor")) },
      { path: "admin/corsi/:courseId/lezioni/:lessonId/compiti", lazy: page(() => import("./pages/admin/AdminHomework")) },
      { path: "admin/corsi/:courseId/lezioni/:lessonId/compiti/nuovo", lazy: page(() => import("./pages/admin/HomeworkEditor")) },
      { path: "admin/corsi/:courseId/lezioni/:lessonId/compiti/:homeworkId/modifica", lazy: page(() => import("./pages/admin/HomeworkEditor")) },
      { path: "admin/prenotazioni", lazy: page(() => import("./pages/admin/AdminCRM")) },
      { path: "admin/crm", lazy: page(() => import("./pages/admin/AdminCRM")) },
      { path: "admin/contatti", lazy: page(() => import("./pages/admin/AdminContatti")) },
      { path: "admin/blog/nuovo", lazy: page(() => import("./pages/admin/BlogEditor")) },
      { path: "admin/blog/:id/modifica", lazy: page(() => import("./pages/admin/BlogEditor")) },
      { path: "admin/utenti", lazy: page(() => import("./pages/admin/AdminUsers")) },
      { path: "admin/commenti", lazy: page(() => import("./pages/admin/AdminStudentComments")) },
      { path: "admin/statistiche", lazy: page(() => import("./pages/admin/AdminStats")) },
      { path: "admin/newsletter", lazy: page(() => import("./pages/admin/AdminNewsletter")) },
      { path: "admin/analytics", lazy: page(() => import("./pages/admin/AdminAnalytics")) },
      { path: "admin/gruppi", lazy: page(() => import("./pages/admin/AdminGroups")) },
      { path: "admin/disponibilita", lazy: page(() => import("./pages/admin/AdminTeacherCalendar")) },
      { path: "admin/link-insegnanti", lazy: page(() => import("./pages/admin/AdminTeacherLinks")) },
      { path: "admin/backup", lazy: page(() => import("./pages/admin/AdminBackups")) },
      { path: "admin/backup-json", lazy: page(() => import("./pages/admin/AdminBackupJson")) },
      { path: "admin/report-lezioni", lazy: page(() => import("./pages/admin/AdminLessonReports")) },
      { path: "admin/documentazione", lazy: page(() => import("./pages/admin/AdminDocumentation")) },
      { path: "admin/access-logs", lazy: page(() => import("./pages/admin/AdminAccessLogs")) },
      { path: "admin/landing-pages", lazy: page(() => import("./pages/admin/AdminLandingPages")) },
      { path: "admin/impostazioni", lazy: page(() => import("./pages/admin/AdminSiteSettings")) },
      { path: "admin/glossario", lazy: page(() => import("./pages/admin/AdminGlossary")) },
      { path: "admin/referral", lazy: page(() => import("./pages/admin/AdminReferrals")) },

      // === Area insegnanti (SPA pura, dietro auth) ===
      { path: "insegnante", lazy: page(() => import("./pages/teacher/TeacherDashboard")) },
      { path: "insegnante/valutazioni", lazy: page(() => import("./pages/teacher/TeacherGrading")) },
      { path: "insegnante/registro-voti", lazy: page(() => import("./pages/teacher/TeacherGradebook")) },
      { path: "insegnante/corso/:courseSlug", lazy: page(() => import("./pages/teacher/TeacherCourseDetail")) },
      { path: "insegnante/corso/:courseSlug/lezione/:lessonNumber", lazy: page(() => import("./pages/teacher/TeacherLessonView")) },
      { path: "insegnante/corso/:courseSlug/lezione/:lessonNumber/task/:taskNumber", lazy: page(() => import("./pages/teacher/TeacherTaskView")) },
      { path: "insegnante/corso/:courseSlug/compito/:homeworkId", lazy: page(() => import("./pages/teacher/TeacherHomeworkView")) },
      { path: "insegnante/gruppo/:groupId", lazy: page(() => import("./pages/teacher/TeacherGroupDetail")) },
      { path: "insegnante/studente/:studentId", lazy: page(() => import("./pages/teacher/TeacherStudentDetail")) },

      // === 404 ===
      { path: "*", lazy: page(() => import("./pages/NotFound")) },
    ],
  },
];
