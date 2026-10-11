import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { MfaSettingsCard } from '@/components/account/MfaSettingsCard';

/** Sicurezza dell'account (tutti i ruoli): gestione della verifica in due passaggi. */
export default function Security() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) navigate('/auth?next=/account/sicurezza');
  }, [user, isLoading, navigate]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto max-w-2xl px-4 py-10">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Indietro
        </Button>
        <h1 className="mb-6 text-2xl font-bold">Sicurezza account</h1>
        <MfaSettingsCard />
      </div>
    </Layout>
  );
}
