import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Eye, EyeOff, ExternalLink, Loader2, Megaphone, Copy
} from 'lucide-react';

interface LandingPageRow {
  id: string;
  title: string;
  slug: string;
  is_active: boolean;
  spots_remaining: number | null;
  created_at: string;
}

export default function AdminLandingPages() {
  const [pages, setPages] = useState<LandingPageRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate('/admin/login');
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) fetchPages();
  }, [user, isAdmin]);

  const fetchPages = async () => {
    const { data, error } = await supabase
      .from('landing_pages')
      .select('id, title, slug, is_active, spots_remaining, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Errore', description: 'Impossibile caricare le landing page', variant: 'destructive' });
    } else {
      setPages(data || []);
    }
    setIsLoading(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from('landing_pages')
      .update({ is_active: !current })
      .eq('id', id);

    if (error) {
      toast({ title: 'Errore', variant: 'destructive' });
    } else {
      setPages(pages.map(p => p.id === id ? { ...p, is_active: !current } : p));
      toast({ title: !current ? 'Attivata' : 'Disattivata' });
    }
  };

  const copyUrl = (slug: string) => {
    const url = `${window.location.origin}/lp/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copiato!', description: url });
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

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <Megaphone className="w-8 h-8 text-primary" />
              Landing Pages
            </h1>
            <p className="text-muted-foreground mt-1">
              {pages.length} landing page{pages.length !== 1 ? '' : ''} • Pagine promozionali per le campagne pubblicitarie
            </p>
          </div>
        </div>

        {pages.length === 0 ? (
          <Card className="p-12 text-center">
            <Megaphone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nessuna landing page</h3>
            <p className="text-muted-foreground">Le landing page appariranno qui quando verranno create.</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pages.map((page) => (
              <Card key={page.id} className="overflow-hidden">
                <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg truncate">{page.title}</h3>
                      <Badge variant={page.is_active ? 'default' : 'secondary'}>
                        {page.is_active ? 'Attiva' : 'Disattivata'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="font-mono bg-muted px-2 py-0.5 rounded">/lp/{page.slug}</span>
                      {page.spots_remaining && (
                        <span>🔥 {page.spots_remaining} posti rimasti</span>
                      )}
                      <span>{new Date(page.created_at).toLocaleDateString('it-IT')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyUrl(page.slug)}
                      title="Copia link"
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copia link
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleActive(page.id, page.is_active)}
                      title={page.is_active ? 'Disattiva' : 'Attiva'}
                    >
                      {page.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/lp/${page.slug}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Apri
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
