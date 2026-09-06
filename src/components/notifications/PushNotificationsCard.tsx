import { useEffect, useState } from 'react';
import { Bell, BellOff, Smartphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { countMyPushDevices, disablePush, enablePush, isPushConfigured } from '@/lib/push';

export function PushNotificationsCard() {
  const [devices, setDevices] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    countMyPushDevices().then(setDevices).catch(() => setDevices(0));
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
              <Button size="sm" variant="outline" onClick={handleEnable} disabled={loading}>
                Attiva su questo dispositivo
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDisable} disabled={loading}>
                <BellOff className="w-4 h-4 mr-2" />
                Disattiva
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={handleEnable} disabled={loading || !configured} className="w-full sm:w-auto">
            <Bell className="w-4 h-4 mr-2" />
            {loading ? 'Attivazione…' : 'Attiva notifiche'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
