import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
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
import AuthPage from "./pages/auth/AuthPage";
import AreaRiservataDashboard from "./pages/area-riservata/Dashboard";
import AreaRiservataProfile from "./pages/area-riservata/Profile";
import CourseProgress from "./pages/area-riservata/CourseProgress";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/prenotazioni" element={<AdminBookings />} />
            <Route path="/admin/blog/nuovo" element={<BlogEditor />} />
            <Route path="/admin/blog/:id/modifica" element={<BlogEditor />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
