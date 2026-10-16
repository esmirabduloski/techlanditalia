import { useEffect, useState } from 'react';
import { Bell, BellOff, Share, SquarePlus, Smartphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { countMyPushDevices, disablePush, enablePush, isIos, isPushConfigured, isStandalone } from '@/lib/push';

export function PushNotificationsCard() {
  const [devices, setDevices] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Su iPhone/iPad le push web arrivano solo al sito installato sulla Home (limite Apple):
  // calcolato dopo il mount perché navigator non esiste durante il prerender.
  const [needsHomeScreen, setNeedsHomeScreen] = useState(false);

  useEffect(() => {
    countMyPushDevices().then(setDevices).catch(() => setDevices(0));
    setNeedsHomeScreen(isIos() && !isStandalone());
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    setNotice(null);
    const result = await enablePush();
    setLoading(false);

    switch (result.status) {
      case 'registered':
        toast.success('Notifiche attivate su questo dispositivo');
        setDevices(await countMyPushDevices());
        break;
      case 'open-in-new-tab':
        setNotice('Apri il sito in una scheda normale (non nell\'anteprima) per attivare le notifiche.');
        break;
      case 'ios-add-to-home':
        setNotice('Su iPhone/iPad: tocca il pulsante Condividi del browser, scegli "Aggiungi a Home" e riapri il sito da lì, poi attiva le notifiche.');
        break;
      case 'denied':
        setNotice('Le notifiche sono bloccate. Vai nelle impostazioni del sito nel tuo browser e consenti le notifiche, poi riprova.');
        break;
      case 'unsupported':
        setNotice('Questo browser non supporta le notifiche push. Prova con Chrome su Android o Safari su iPhone (dopo "Aggiungi a Home").');
        break;
      case 'not-configured':
        setNotice('Le notifiche non sono ancora configurate. Riprova più tardi.');
        break;
      default:
        setNotice(result.message || 'Errore durante l\'attivazione. Riprova.');
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    const { error } = await disablePush();
    setLoading(false);
    if (error) {
      toast.error('Errore: ' + error);
      return;
    }
    setDevices(0);
    toast.success('Notifiche disattivate');
  };

  const configured = isPushConfigured();

  // Già attive e niente da spiegare: una riga sottile invece della card grande
  if (devices > 0 && !notice && !needsHomeScreen) {
    return (
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-primary/20 px-4 py-2 text-sm">
        <span className="flex items-center gap-2 flex-1 min-w-0 text-muted-foreground">
          <Bell className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          Promemoria lezioni attivi su {devices} dispositiv{devices === 1 ? 'o' : 'i'}
        </span>
        <span className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={handleEnable} disabled={loading}>
            Attiva anche qui
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDisable} disabled={loading}>
            Disattiva
          </Button>
        </span>
      </div>
    );
  }

  return (
    <Card className="mb-6 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="w-5 h-5 text-primary" />
          Promemoria lezioni sul telefono
        </CardTitle>
        <CardDescription>
          Ricevi una notifica 24 ore prima di ogni lezione. Serve solo un permesso, una volta per dispositivo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {needsHomeScreen && (
          <Alert>
            <Smartphone className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <p className="font-medium">Su iPhone e iPad le notifiche arrivano solo se aggiungi TECHLAND alla schermata Home.</p>
              <ol className="list-decimal pl-5 space-y-1 text-sm">
                <li>
                  In Safari tocca il pulsante Condividi <Share className="inline w-4 h-4 align-text-bottom" aria-label="Condividi" />
                </li>
                <li>
                  Scegli «Aggiungi alla schermata Home» <SquarePlus className="inline w-4 h-4 align-text-bottom" aria-hidden="true" />
                </li>
                <li>Apri TECHLAND dall'icona sulla Home, entra nella tua area e tocca «Attiva notifiche».</li>
              </ol>
            </AlertDescription>
          </Alert>
        )}

        {notice && (
          <Alert variant="destructive">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        {devices > 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-muted-foreground flex items-center gap-2 flex-1">
              <Smartphone className="w-4 h-4 text-primary" />
              Attive su {devices} dispositiv{devices === 1 ? 'o' : 'i'}
            </p>
            <div className="flex gap-2">
              {!needsHomeScreen && (
                <Button size="sm" variant="outline" onClick={handleEnable} disabled={loading}>
                  Attiva su questo dispositivo
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={handleDisable} disabled={loading}>
                <BellOff className="w-4 h-4 mr-2" />
                Disattiva
              </Button>
            </div>
          </div>
        ) : needsHomeScreen ? null : (
          <Button onClick={handleEnable} disabled={loading || !configured} className="w-full sm:w-auto">
            <Bell className="w-4 h-4 mr-2" />
            {loading ? 'Attivazione…' : 'Attiva notifiche'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
