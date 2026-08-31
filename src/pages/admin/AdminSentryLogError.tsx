import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Loader2, Bug } from 'lucide-react';

function ErrorButton() {
  return (
    <Button
      variant="destructive"
      onClick={() => {
        Sentry.logger.info('User triggered test error', {
          action: 'test_error_button_click',
        });
        throw new Error('This is your first error!');
      }}
    >
      Break the world
    </Button>
  );
}

export default function AdminSentryLogError() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate('/admin/login');
  }, [user, isAdmin, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminHeader />
      <AdminNav />
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Bug className="w-8 h-8 text-primary" />
            Sentry Log error
          </h1>
          <p className="text-muted-foreground mt-1">
            Verifica che il monitoraggio errori di Sentry funzioni correttamente
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Test errore</CardTitle>
            <CardDescription>
              Il pulsante lancia un errore volontario nel browser. Se Sentry è configurato correttamente,
              l'evento comparirà nel progetto Sentry entro pochi secondi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ErrorButton />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
