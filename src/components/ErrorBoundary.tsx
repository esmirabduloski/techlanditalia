import * as Sentry from "@sentry/react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Error boundary globale: se un componente va in errore l'utente vede una
 * schermata in italiano con la possibilità di riprovare, invece di una pagina
 * bianca. L'errore viene inviato a Sentry per la diagnosi.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
  }

  private handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className="min-h-screen flex items-center justify-center px-4 bg-background"
      >
        <div className="max-w-md text-center">
          <p className="text-sm font-semibold text-primary mb-3">Errore imprevisto</p>
          <h1 className="text-3xl font-bold mb-4">Qualcosa è andato storto</h1>
          <p className="text-muted-foreground mb-8">
            Ci scusiamo per il disagio. Riprova a caricare la pagina: se il problema
            continua, scrivici a{" "}
            <a className="underline" href="mailto:info@techlanditalia.it">
              info@techlanditalia.it
            </a>
            .
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={this.handleReload}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Ricarica la pagina
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <a href="/">
                <Home className="w-4 h-4 mr-2" />
                Torna alla home
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
