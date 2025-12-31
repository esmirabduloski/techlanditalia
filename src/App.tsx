import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Corsi from "./pages/Corsi";
import CorsoDettaglio from "./pages/CorsoDettaglio";
import ChiSiamo from "./pages/ChiSiamo";
import Blog from "./pages/Blog";
import BlogArticle from "./pages/BlogArticle";
import Prenota from "./pages/Prenota";
import FAQ from "./pages/FAQ";
import Privacy from "./pages/Privacy";
import Termini from "./pages/Termini";
import Cookie from "./pages/Cookie";
import Contatti from "./pages/Contatti";
import LavoraConNoi from "./pages/LavoraConNoi";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminBookings from "./pages/admin/AdminBookings";
import BlogEditor from "./pages/admin/BlogEditor";
import AdminContatti from "./pages/admin/AdminContatti";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminStats from "./pages/admin/AdminStats";
import AdminCourses from "./pages/admin/AdminCourses";
import AdminLessons from "./pages/admin/AdminLessons";
import LessonEditor from "./pages/admin/LessonEditor";
import AdminTasks from "./pages/admin/AdminTasks";
import TaskEditor from "./pages/admin/TaskEditor";
import AdminHomework from "./pages/admin/AdminHomework";
import AdminNewsletter from "./pages/admin/AdminNewsletter";
import AuthPage from "./pages/auth/AuthPage";
import AreaRiservataDashboard from "./pages/area-riservata/Dashboard";
import AreaRiservataProfile from "./pages/area-riservata/Profile";
import CourseProgress from "./pages/area-riservata/CourseProgress";
import LessonView from "./pages/area-riservata/LessonView";
import TaskView from "./pages/area-riservata/TaskView";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/area-riservata" element={<AreaRiservataDashboard />} />
            <Route path="/area-riservata/profilo" element={<AreaRiservataProfile />} />
            <Route path="/area-riservata/corso/:courseId" element={<CourseProgress />} />
            <Route path="/area-riservata/corso/:courseId/lezione/:lessonNumber" element={<LessonView />} />
            <Route path="/area-riservata/corso/:courseId/lezione/:lessonNumber/task/:taskNumber" element={<TaskView />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/corsi" element={<AdminCourses />} />
            <Route path="/admin/corsi/:courseId/lezioni" element={<AdminLessons />} />
            <Route path="/admin/corsi/:courseId/lezioni/nuova" element={<LessonEditor />} />
            <Route path="/admin/corsi/:courseId/lezioni/:lessonId/modifica" element={<LessonEditor />} />
            <Route path="/admin/corsi/:courseId/lezioni/:lessonId/task" element={<AdminTasks />} />
            <Route path="/admin/corsi/:courseId/lezioni/:lessonId/task/nuovo" element={<TaskEditor />} />
            <Route path="/admin/corsi/:courseId/lezioni/:lessonId/task/:taskId/modifica" element={<TaskEditor />} />
            <Route path="/admin/corsi/:courseId/lezioni/:lessonId/compiti" element={<AdminHomework />} />
            <Route path="/admin/prenotazioni" element={<AdminBookings />} />
            <Route path="/admin/contatti" element={<AdminContatti />} />
            <Route path="/admin/blog/nuovo" element={<BlogEditor />} />
            <Route path="/admin/blog/:id/modifica" element={<BlogEditor />} />
            <Route path="/admin/utenti" element={<AdminUsers />} />
            <Route path="/admin/statistiche" element={<AdminStats />} />
            <Route path="/admin/newsletter" element={<AdminNewsletter />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </ThemeProvider>
  </QueryClientProvider>
);

export default App;
