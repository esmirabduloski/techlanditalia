import { Outlet } from "react-router-dom";
import { Head } from "vite-react-ssg";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { ClarityGuard } from "@/components/analytics/ClarityGuard";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { SkipToContent } from "@/components/accessibility/SkipToContent";
import { RouteAnnouncer } from "@/components/accessibility/RouteAnnouncer";
import { PushNavigationListener } from "@/components/notifications/PushNavigationListener";
import ScrollToTop from "./components/ScrollToTop";
import { ErrorBoundary } from "@/components/ErrorBoundary";


const queryClient = new QueryClient();

// Root layout: router e mounting sono gestiti da vite-react-ssg (src/main.tsx + src/routes.tsx).
const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <ImpersonationProvider>
          <TooltipProvider>
            {/* Fallback per le route senza SEOHead (aree private): le pagine pubbliche lo sovrascrivono */}
            <Head defer={false} defaultTitle="TECHLAND | Coding per Bambini e Ragazzi 6-18">
              <meta name="application-name" content="TECHLAND" />
            </Head>
            <Sonner />
            <SkipToContent />
            <ImpersonationBanner />
            <AnalyticsProvider>
              <ScrollToTop />
              <RouteAnnouncer />
              <PushNavigationListener />
              <ClarityGuard />
              {/* Nessun <Suspense> qui: il caricamento lazy delle route è gestito dal
                  data router di React Router. Un boundary a questo livello avvolgeva
                  tutta la pagina prerenderata e, appena un provider sopra aggiornava lo
                  stato durante l'hydration, React scartava l'HTML del server e
                  ri-renderizzava tutto lato client (errore #421): schermo vuoto per
                  secondi sui telefoni. */}
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>

            </AnalyticsProvider>
          </TooltipProvider>
        </ImpersonationProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
