import { lazy, Suspense, useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { SkipToContent } from "@/components/accessibility/SkipToContent";
import { RouteAnnouncer } from "@/components/accessibility/RouteAnnouncer";
import ScrollToTop from "./components/ScrollToTop";
import Index from "./pages/Index";

// Lazy-loaded routes
const Corsi = lazy(() => import("./pages/Corsi"));
const CorsoDettaglio = lazy(() => import("./pages/CorsoDettaglio"));
const ChiSiamo = lazy(() => import("./pages/ChiSiamo"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogArticle = lazy(() => import("./pages/BlogArticle"));
const Prenota = lazy(() => import("./pages/Prenota"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Termini = lazy(() => import("./pages/Termini"));
const Cookie = lazy(() => import("./pages/Cookie"));
const Contatti = lazy(() => import("./pages/Contatti"));
const LavoraConNoi = lazy(() => import("./pages/LavoraConNoiGuard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminBookings = lazy(() => import("./pages/admin/AdminBookings"));
const AdminCRM = lazy(() => import("./pages/admin/AdminCRM"));
const BlogEditor = lazy(() => import("./pages/admin/BlogEditor"));
const AdminContatti = lazy(() => import("./pages/admin/AdminContatti"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminStats = lazy(() => import("./pages/admin/AdminStats"));
const AdminCourses = lazy(() => import("./pages/admin/AdminCourses"));
const AdminCourseContent = lazy(() => import("./pages/admin/AdminCourseContent"));
const AdminLessons = lazy(() => import("./pages/admin/AdminLessons"));
const LessonEditor = lazy(() => import("./pages/admin/LessonEditor"));
const AdminTasks = lazy(() => import("./pages/admin/AdminTasks"));
const TaskEditor = lazy(() => import("./pages/admin/TaskEditor"));
const AdminHomework = lazy(() => import("./pages/admin/AdminHomework"));
const HomeworkEditor = lazy(() => import("./pages/admin/HomeworkEditor"));
const HomeworkView = lazy(() => import("./pages/area-riservata/HomeworkView"));
const AdminNewsletter = lazy(() => import("./pages/admin/AdminNewsletter"));
const AdminStudentComments = lazy(() => import("./pages/admin/AdminStudentComments"));
const AdminGrading = lazy(() => import("./pages/admin/AdminGrading"));
const AdminScheduledLessons = lazy(() => import("./pages/admin/AdminScheduledLessons"));

const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AuthPage = lazy(() => import("./pages/auth/AuthPage"));
const AreaRiservataDashboard = lazy(() => import("./pages/area-riservata/Dashboard"));
const AreaRiservataProfile = lazy(() => import("./pages/area-riservata/Profile"));
const CourseProgress = lazy(() => import("./pages/area-riservata/CourseProgress"));
const LessonView = lazy(() => import("./pages/area-riservata/LessonView"));
const TaskView = lazy(() => import("./pages/area-riservata/TaskView"));
const HomeworkDetail = lazy(() => import("./pages/area-riservata/HomeworkDetail"));
const TeacherDashboard = lazy(() => import("./pages/teacher/TeacherDashboard"));
const TeacherCourseDetail = lazy(() => import("./pages/teacher/TeacherCourseDetail"));
const TeacherGroupDetail = lazy(() => import("./pages/teacher/TeacherGroupDetail"));
const TeacherStudentDetail = lazy(() => import("./pages/teacher/TeacherStudentDetail"));
const TeacherLessonView = lazy(() => import("./pages/teacher/TeacherLessonView"));
const TeacherTaskView = lazy(() => import("./pages/teacher/TeacherTaskView"));
const TeacherHomeworkView = lazy(() => import("./pages/teacher/TeacherHomeworkView"));
const TeacherGrading = lazy(() => import("./pages/teacher/TeacherGrading"));
const TeacherGradebook = lazy(() => import("./pages/teacher/TeacherGradebook"));
const AdminGroups = lazy(() => import("./pages/admin/AdminGroups"));
const AdminTeacherCalendar = lazy(() => import("./pages/admin/AdminTeacherCalendar"));
const AdminTeacherLinks = lazy(() => import("./pages/admin/AdminTeacherLinks"));
const AdminBackups = lazy(() => import("./pages/admin/AdminBackups"));
const AdminLessonReports = lazy(() => import("./pages/admin/AdminLessonReports"));
const AdminDocumentation = lazy(() => import("./pages/admin/AdminDocumentation"));
const AdminAccessLogs = lazy(() => import("./pages/admin/AdminAccessLogs"));
const Acquisti = lazy(() => import("./pages/area-riservata/Acquisti"));
const Leaderboard = lazy(() => import("./pages/area-riservata/Leaderboard"));
const Accessibilita = lazy(() => import("./pages/Accessibilita"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const AdminLandingPages = lazy(() => import("./pages/admin/AdminLandingPages"));
const AdminSiteSettings = lazy(() => import("./pages/admin/AdminSiteSettings"));
const AdminGlossary = lazy(() => import("./pages/admin/AdminGlossary"));
const AdminReferrals = lazy(() => import("./pages/admin/AdminReferrals"));
const Glossario = lazy(() => import("./pages/Glossario"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

const queryClient = new QueryClient();

const lazyRetry = (importFn: () => Promise<any>) =>
  lazy(() =>
    importFn().catch(() => {
      // Force reload on stale chunk errors
      window.location.reload();
      return importFn();
    })
  );

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <ImpersonationProvider>
          <TooltipProvider>
            <Sonner />
            <BrowserRouter>
              <SkipToContent />
              <ImpersonationBanner />
              <AnalyticsProvider>
                <ScrollToTop />
                <RouteAnnouncer />
                <Suspense fallback={<div role="status" aria-busy="true" aria-label="Caricamento pagina" className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/corsi" element={<Corsi />} />
                    <Route path="/corsi/:id" element={<CorsoDettaglio />} />
                    <Route path="/chi-siamo" element={<ChiSiamo />} />
                    <Route path="/blog" element={<Blog />} />
                    <Route path="/blog/:slug" element={<BlogArticle />} />
                    <Route path="/prenota" element={<Prenota />} />
                    <Route path="/faq" element={<FAQ />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/termini" element={<Termini />} />
                    <Route path="/cookie" element={<Cookie />} />
                    <Route path="/contatti" element={<Contatti />} />
                    <Route path="/lavora-con-noi" element={<LavoraConNoi />} />
                    <Route path="/accessibilita" element={<Accessibilita />} />
                    <Route path="/glossario" element={<Glossario />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                    <Route path="/area-riservata" element={<AreaRiservataDashboard />} />
                    <Route path="/area-riservata/profilo" element={<AreaRiservataProfile />} />
                    <Route path="/area-riservata/corso/:courseId" element={<CourseProgress />} />
                    <Route path="/area-riservata/corso/:courseId/lezione/:lessonNumber" element={<LessonView />} />
                    <Route path="/area-riservata/corso/:courseId/lezione/:lessonNumber/task/:taskNumber" element={<TaskView />} />
                    <Route path="/area-riservata/compito/:homeworkId" element={<HomeworkView />} />
                    <Route path="/area-riservata/compito-dettaglio/:homeworkId" element={<HomeworkDetail />} />
                    <Route path="/area-riservata/acquisti" element={<Acquisti />} />
                    <Route path="/area-riservata/classifica" element={<Leaderboard />} />
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/corsi" element={<AdminCourses />} />
                    <Route path="/admin/corsi/:courseId/lezioni" element={<AdminLessons />} />
                    <Route path="/admin/corsi/:courseId/contenuto" element={<AdminCourseContent />} />
                    <Route path="/admin/corsi/:courseId/lezioni/nuova" element={<LessonEditor />} />
                    <Route path="/admin/corsi/:courseId/lezioni/:lessonId/modifica" element={<LessonEditor />} />
                    <Route path="/admin/corsi/:courseId/lezioni/:lessonId/task" element={<AdminTasks />} />
                    <Route path="/admin/corsi/:courseId/lezioni/:lessonId/task/nuovo" element={<TaskEditor />} />
                    <Route path="/admin/corsi/:courseId/lezioni/:lessonId/task/:taskId/modifica" element={<TaskEditor />} />
                    <Route path="/admin/corsi/:courseId/lezioni/:lessonId/compiti" element={<AdminHomework />} />
                    <Route path="/admin/corsi/:courseId/lezioni/:lessonId/compiti/nuovo" element={<HomeworkEditor />} />
                    <Route path="/admin/corsi/:courseId/lezioni/:lessonId/compiti/:homeworkId/modifica" element={<HomeworkEditor />} />
                    <Route path="/admin/prenotazioni" element={<AdminCRM />} />
                    <Route path="/admin/crm" element={<AdminCRM />} />
                    <Route path="/admin/contatti" element={<AdminContatti />} />
                    <Route path="/admin/blog/nuovo" element={<BlogEditor />} />
                    <Route path="/admin/blog/:id/modifica" element={<BlogEditor />} />
                    <Route path="/admin/utenti" element={<AdminUsers />} />
                    <Route path="/admin/commenti" element={<AdminStudentComments />} />
                    <Route path="/admin/valutazioni" element={<AdminGrading />} />
                    <Route path="/admin/statistiche" element={<AdminStats />} />
                    <Route path="/admin/newsletter" element={<AdminNewsletter />} />
                    
                    
                    <Route path="/admin/analytics" element={<AdminAnalytics />} />
                    <Route path="/admin/gruppi" element={<AdminGroups />} />
                    <Route path="/admin/disponibilita" element={<AdminTeacherCalendar />} />
                    <Route path="/admin/link-insegnanti" element={<AdminTeacherLinks />} />
                    <Route path="/admin/backup" element={<AdminBackups />} />
                    <Route path="/admin/report-lezioni" element={<AdminLessonReports />} />
                    <Route path="/admin/documentazione" element={<AdminDocumentation />} />
                    <Route path="/admin/access-logs" element={<AdminAccessLogs />} />
                    <Route path="/admin/landing-pages" element={<AdminLandingPages />} />
                    <Route path="/admin/impostazioni" element={<AdminSiteSettings />} />
                    <Route path="/admin/glossario" element={<AdminGlossary />} />
                    <Route path="/admin/referral" element={<AdminReferrals />} />
                    <Route path="/lp/:slug" element={<LandingPage />} />
                    <Route path="/insegnante" element={<TeacherDashboard />} />
                    <Route path="/insegnante/valutazioni" element={<TeacherGrading />} />
                    <Route path="/insegnante/registro-voti" element={<TeacherGradebook />} />
                    <Route path="/insegnante/corso/:courseSlug" element={<TeacherCourseDetail />} />
                    <Route path="/insegnante/corso/:courseSlug/lezione/:lessonNumber" element={<TeacherLessonView />} />
                    <Route path="/insegnante/corso/:courseSlug/lezione/:lessonNumber/task/:taskNumber" element={<TeacherTaskView />} />
                    <Route path="/insegnante/corso/:courseSlug/compito/:homeworkId" element={<TeacherHomeworkView />} />
                    <Route path="/insegnante/gruppo/:groupId" element={<TeacherGroupDetail />} />
                    <Route path="/insegnante/studente/:studentId" element={<TeacherStudentDetail />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </AnalyticsProvider>
            </BrowserRouter>
        </TooltipProvider>
      </ImpersonationProvider>
    </AuthProvider>
  </ThemeProvider>
  </QueryClientProvider>
);

export default App;
