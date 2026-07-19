import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Head } from "vite-react-ssg";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { SkipToContent } from "@/components/accessibility/SkipToContent";
import { RouteAnnouncer } from "@/components/accessibility/RouteAnnouncer";
import ScrollToTop from "./components/ScrollToTop";

const queryClient = new QueryClient();

// Root layout: router e mounting sono gestiti da vite-react-ssg (src/main.tsx + src/routes.tsx).
const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <ImpersonationProvider>
          <TooltipProvider>
            {/* Fallback per le route senza SEOHead (aree private): le pagine pubbliche lo sovrascrivono */}
            <Head defaultTitle="TECHLAND | Coding per Bambini e Ragazzi 6-18">
              <meta name="application-name" content="TECHLAND" />
            </Head>
            <Sonner />
            <SkipToContent />
            <ImpersonationBanner />
            <AnalyticsProvider>
              <ScrollToTop />
              <RouteAnnouncer />
              <Suspense
                fallback={
                  <div
                    role="status"
                    aria-busy="true"
                    aria-label="Caricamento pagina"
                    className="min-h-screen flex items-center justify-center"
                  >
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                }
              >
                <Outlet />
              </Suspense>
            </AnalyticsProvider>
          </TooltipProvider>
        </ImpersonationProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
