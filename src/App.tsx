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
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminBookings from "./pages/admin/AdminBookings";
import BlogEditor from "./pages/admin/BlogEditor";

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
            <Route path="/privacy" element={<Privacy />} />
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
