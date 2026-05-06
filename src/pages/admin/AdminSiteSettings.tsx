import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Loader2, Settings as SettingsIcon, Eye, EyeOff } from 'lucide-react';

export default function AdminSiteSettings() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lavoraVisible, setLavoraVisible] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate('/admin/login');
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('key, value')
        .eq('key', 'lavora_con_noi_visible')
        .maybeSingle();
      if (data?.value !== undefined && data?.value !== null) {
        setLavoraVisible(Boolean(data.value));
      }
      setIsLoading(false);
    };
    if (user && isAdmin) fetchSettings();
  }, [user, isAdmin]);

  const updateSetting = async (key: string, value: unknown, label: string) => {
    setIsSaving(true);
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key, value: value as never, updated_at: new Date().toISOString(), updated_by: user?.id }, { onConflict: 'key' });
    setIsSaving(false);
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Salvato', description: label });
    return true;
  };

  const handleToggleLavora = async (checked: boolean) => {
    setLavoraVisible(checked);
    const ok = await updateSetting('lavora_con_noi_visible', checked, checked ? 'Pagina "Lavora con noi" visibile' : 'Pagina "Lavora con noi" nascosta');
    if (!ok) setLavoraVisible(!checked);
  };

  if (authLoading || isLoading) {
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
            <SettingsIcon className="w-8 h-8 text-primary" />
            Impostazioni Sito
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci la visibilità delle pagine pubbliche
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {lavoraVisible ? <Eye className="w-5 h-5 text-primary" /> : <EyeOff className="w-5 h-5 text-muted-foreground" />}
              Pagina "Lavora con noi"
            </CardTitle>
            <CardDescription>
              Quando disattivata, la pagina <code className="px-1 py-0.5 bg-muted rounded text-xs">/lavora-con-noi</code> non sarà accessibile e verrà rimossa dal footer del sito.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">{lavoraVisible ? 'Visibile' : 'Nascosta'}</p>
              <p className="text-sm text-muted-foreground">
                {lavoraVisible ? 'I visitatori possono vedere la pagina e candidarsi.' : 'La pagina è nascosta dal pubblico.'}
              </p>
            </div>
            <Switch
              checked={lavoraVisible}
              onCheckedChange={handleToggleLavora}
              disabled={isSaving}
              aria-label="Mostra o nascondi la pagina Lavora con noi"
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
