import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminNav } from "@/components/admin/AdminNav";
import { Loader2, Plus, Trash2, Edit2, ExternalLink, GripVertical, Link as LinkIcon, Home, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TeacherLink {
  id: string;
  title: string;
  url: string;
  description: string | null;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

const AVAILABLE_ICONS = [
  { value: 'link', label: 'Link' },
  { value: 'book', label: 'Libro' },
  { value: 'file', label: 'File' },
  { value: 'calendar', label: 'Calendario' },
  { value: 'video', label: 'Video' },
  { value: 'message', label: 'Messaggio' },
  { value: 'help', label: 'Aiuto' },
  { value: 'settings', label: 'Impostazioni' },
  { value: 'star', label: 'Stella' },
  { value: 'globe', label: 'Globo' },
];

export default function AdminTeacherLinks() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [links, setLinks] = useState<TeacherLink[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<TeacherLink | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIcon, setFormIcon] = useState("link");

  useEffect(() => {
    if (!authLoading && user) {
      checkAdminRole();
    } else if (!authLoading && !user) {
      navigate('/admin/login');
    }
  }, [user, authLoading, navigate]);

  const checkAdminRole = async () => {
    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        navigate('/admin/login');
        return;
      }

      setIsAdmin(true);
      await fetchLinks();
    } catch (error) {
      console.error("Error checking admin role:", error);
      navigate('/admin/login');
    }
  };

  const fetchLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('teacher_links')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setLinks(data || []);
    } catch (error) {
      console.error("Error fetching links:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormTitle("");
    setFormUrl("");
    setFormDescription("");
    setFormIcon("link");
    setEditingLink(null);
  };

  const openEditDialog = (link: TeacherLink) => {
    setEditingLink(link);
    setFormTitle(link.title);
    setFormUrl(link.url);
    setFormDescription(link.description || "");
    setFormIcon(link.icon);
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formUrl.trim()) {
      toast({ title: 'Errore', description: 'Titolo e URL sono obbligatori', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      if (editingLink) {
        // Update existing
        const { error } = await supabase
          .from('teacher_links')
          .update({
            title: formTitle.trim(),
            url: formUrl.trim(),
            description: formDescription.trim() || null,
            icon: formIcon,
          })
          .eq('id', editingLink.id);

        if (error) throw error;
        toast({ title: 'Salvato', description: 'Link aggiornato con successo' });
      } else {
        // Create new
        const maxOrder = links.length > 0 ? Math.max(...links.map(l => l.sort_order)) : 0;
        const { error } = await supabase
          .from('teacher_links')
          .insert({
            title: formTitle.trim(),
            url: formUrl.trim(),
            description: formDescription.trim() || null,
            icon: formIcon,
            sort_order: maxOrder + 1,
          });

        if (error) throw error;
        toast({ title: 'Creato', description: 'Nuovo link aggiunto' });
      }

      setDialogOpen(false);
      resetForm();
      await fetchLinks();
    } catch (error: any) {
      console.error("Error saving link:", error);
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (link: TeacherLink) => {
    try {
      const { error } = await supabase
        .from('teacher_links')
        .update({ is_active: !link.is_active })
        .eq('id', link.id);

      if (error) throw error;
      await fetchLinks();
    } catch (error: any) {
      console.error("Error toggling link:", error);
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo link?')) return;

    try {
      const { error } = await supabase
        .from('teacher_links')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Eliminato', description: 'Link rimosso con successo' });
      await fetchLinks();
    } catch (error: any) {
      console.error("Error deleting link:", error);
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newLinks = [...links];
    [newLinks[index - 1], newLinks[index]] = [newLinks[index], newLinks[index - 1]];
    
    try {
      await Promise.all(
        newLinks.map((link, i) => 
          supabase.from('teacher_links').update({ sort_order: i }).eq('id', link.id)
        )
      );
      await fetchLinks();
    } catch (error) {
      console.error("Error reordering:", error);
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === links.length - 1) return;
    const newLinks = [...links];
    [newLinks[index], newLinks[index + 1]] = [newLinks[index + 1], newLinks[index]];
    
    try {
      await Promise.all(
        newLinks.map((link, i) => 
          supabase.from('teacher_links').update({ sort_order: i }).eq('id', link.id)
        )
      );
      await fetchLinks();
    } catch (error) {
      console.error("Error reordering:", error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
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
      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-2xl font-bold">
              <span className="text-primary">TECH</span>
              <span className="text-tech-teal">LAND</span>
            </Link>
            <Badge className="bg-primary text-primary-foreground">Admin</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="outline" size="sm">
                <Home className="w-4 h-4 mr-2" />
                Home
              </Button>
            </Link>
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Esci
            </Button>
          </div>
        </div>
      </header>

      <AdminNav />

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <LinkIcon className="w-8 h-8 text-primary" />
              Link Utili Insegnanti
            </h1>
            <p className="text-muted-foreground mt-1">
              Gestisci i link visibili nella dashboard degli insegnanti
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Nuovo Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingLink ? 'Modifica Link' : 'Nuovo Link'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Titolo *</label>
                  <Input 
                    value={formTitle} 
                    onChange={(e) => setFormTitle(e.target.value)} 
                    placeholder="Es: Manuale Didattico"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">URL *</label>
                  <Input 
                    value={formUrl} 
                    onChange={(e) => setFormUrl(e.target.value)} 
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrizione</label>
                  <Textarea 
                    value={formDescription} 
                    onChange={(e) => setFormDescription(e.target.value)} 
                    placeholder="Breve descrizione del link..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Icona</label>
                  <Select value={formIcon} onValueChange={setFormIcon}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_ICONS.map(icon => (
                        <SelectItem key={icon.value} value={icon.value}>
                          {icon.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Annulla
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Salvando...
                      </>
                    ) : 'Salva'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Link Configurati ({links.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {links.length === 0 ? (
              <div className="text-center py-8">
                <LinkIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nessun link configurato</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Aggiungi il primo link cliccando "Nuovo Link"
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Titolo</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead className="text-center">Attivo</TableHead>
                    <TableHead className="w-28">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((link, index) => (
                    <TableRow key={link.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                          >
                            ↑
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === links.length - 1}
                          >
                            ↓
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{link.title}</TableCell>
                      <TableCell>
                        <a 
                          href={link.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {link.url.length > 40 ? link.url.substring(0, 40) + '...' : link.url}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {link.description || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch 
                          checked={link.is_active} 
                          onCheckedChange={() => handleToggleActive(link)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => openEditDialog(link)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDelete(link.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
