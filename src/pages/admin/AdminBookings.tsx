import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  LogOut,
  Loader2,
  Calendar,
  Phone,
  Mail,
  Clock,
  User,
  MessageSquare,
  ChevronDown,
  FileText,
  BookOpen,
  Users,
  Plus,
  Trash2,
  Edit,
  Home,
  BarChart3,
  GraduationCap
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

interface TrialBooking {
  id: string;
  parent_name: string;
  email: string;
  phone: string | null;
  child_age: number;
  interest: string;
  availability: string | null;
  message: string | null;
  status: 'pending' | 'contacted' | 'scheduled' | 'completed' | 'cancelled';
  admin_notes: string | null;
  created_at: string;
}

const statusConfig = {
  pending: { label: 'In attesa', variant: 'secondary' as const, color: 'bg-yellow-500' },
  contacted: { label: 'Contattato', variant: 'default' as const, color: 'bg-blue-500' },
  scheduled: { label: 'Programmato', variant: 'default' as const, color: 'bg-purple-500' },
  completed: { label: 'Completato', variant: 'default' as const, color: 'bg-green-500' },
  cancelled: { label: 'Annullato', variant: 'destructive' as const, color: 'bg-red-500' },
};

const interestLabels: Record<string, string> = {
  "coding-base": "Coding Base (6-8 anni)",
  "game-dev": "Game Development",
  "roblox": "Roblox Studio",
  "web": "Web Development",
  "python-ai": "Python & AI",
  "non-so": "Non sicuro",
};

const availabilityLabels: Record<string, string> = {
  "mattina": "Mattina (9-12)",
  "pomeriggio": "Pomeriggio (14-18)",
  "sera": "Sera (18-20)",
  "weekend": "Weekend",
  "qualsiasi": "Qualsiasi orario",
};

const weekDays = [
  { value: "lunedi", label: "Lunedì" },
  { value: "martedi", label: "Martedì" },
  { value: "mercoledi", label: "Mercoledì" },
  { value: "giovedi", label: "Giovedì" },
  { value: "venerdi", label: "Venerdì" },
  { value: "sabato", label: "Sabato" },
  { value: "domenica", label: "Domenica" },
];

const timeSlots = Array.from({ length: 12 }, (_, i) => {
  const hour = i + 9; // 9:00 to 20:00
  return { value: `${hour}:00`, label: `${hour}:00` };
});

const interests = [
  { value: "coding-base", label: "Coding Base (6-8 anni)" },
  { value: "game-dev", label: "Game Development" },
  { value: "roblox", label: "Roblox Studio" },
  { value: "web", label: "Web Development" },
  { value: "python-ai", label: "Python & AI" },
  { value: "non-so", label: "Non sono sicuro" },
];

export default function AdminBookings() {
  const [bookings, setBookings] = useState<TrialBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<TrialBooking | null>(null);
  const [formData, setFormData] = useState({
    parent_name: '',
    email: '',
    phone: '',
    child_age: '8',
    interest: 'coding-base',
    preferred_day: '',
    preferred_time: '',
    message: '',
    status: 'pending' as TrialBooking['status'],
  });
  const [isSaving, setIsSaving] = useState(false);
  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/admin/login');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchBookings();
    }
  }, [user, isAdmin]);

  const fetchBookings = async () => {
    const { data, error } = await supabase
      .from('trial_bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Errore', description: 'Impossibile caricare le prenotazioni', variant: 'destructive' });
    } else {
      setBookings((data as TrialBooking[]) || []);
    }
    setIsLoading(false);
  };

  const updateStatus = async (id: string, newStatus: TrialBooking['status']) => {
    const { error } = await supabase
      .from('trial_bookings')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      toast({ title: 'Errore', description: 'Impossibile aggiornare lo stato', variant: 'destructive' });
    } else {
      setBookings(bookings.map(b => b.id === id ? { ...b, status: newStatus } : b));
      toast({ title: 'Successo', description: 'Stato aggiornato' });
    }
  };

  const saveNotes = async (id: string) => {
    const { error } = await supabase
      .from('trial_bookings')
      .update({ admin_notes: notesValue })
      .eq('id', id);

    if (error) {
      toast({ title: 'Errore', description: 'Impossibile salvare le note', variant: 'destructive' });
    } else {
      setBookings(bookings.map(b => b.id === id ? { ...b, admin_notes: notesValue } : b));
      setEditingNotes(null);
      toast({ title: 'Successo', description: 'Note salvate' });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const resetForm = () => {
    setFormData({
      parent_name: '',
      email: '',
      phone: '',
      child_age: '8',
      interest: 'coding-base',
      preferred_day: '',
      preferred_time: '',
      message: '',
      status: 'pending',
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setShowCreateDialog(true);
  };

  const openEditDialog = (booking: TrialBooking) => {
    setSelectedBooking(booking);
    // Parse availability to get day and time
    const availParts = booking.availability?.split(' - ') || [];
    setFormData({
      parent_name: booking.parent_name,
      email: booking.email,
      phone: booking.phone || '',
      child_age: String(booking.child_age),
      interest: booking.interest,
      preferred_day: availParts[0] || '',
      preferred_time: availParts[1] || '',
      message: booking.message || '',
      status: booking.status,
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (booking: TrialBooking) => {
    setSelectedBooking(booking);
    setShowDeleteDialog(true);
  };

  const handleCreate = async () => {
    if (!formData.parent_name || !formData.email) {
      toast({ title: 'Errore', description: 'Nome e email sono obbligatori', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const availability = formData.preferred_day && formData.preferred_time 
      ? `${formData.preferred_day} - ${formData.preferred_time}`
      : formData.preferred_day || formData.preferred_time || null;

    const { error } = await supabase
      .from('trial_bookings')
      .insert({
        parent_name: formData.parent_name,
        email: formData.email,
        phone: formData.phone || null,
        child_age: parseInt(formData.child_age),
        interest: formData.interest,
        availability,
        message: formData.message || null,
        status: formData.status,
      });

    if (error) {
      toast({ title: 'Errore', description: 'Impossibile creare la prenotazione', variant: 'destructive' });
    } else {
      toast({ title: 'Successo', description: 'Prenotazione creata' });
      setShowCreateDialog(false);
      fetchBookings();
    }
    setIsSaving(false);
  };

  const handleEdit = async () => {
    if (!selectedBooking || !formData.parent_name || !formData.email) {
      toast({ title: 'Errore', description: 'Nome e email sono obbligatori', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const availability = formData.preferred_day && formData.preferred_time 
      ? `${formData.preferred_day} - ${formData.preferred_time}`
      : formData.preferred_day || formData.preferred_time || null;

    const { error } = await supabase
      .from('trial_bookings')
      .update({
        parent_name: formData.parent_name,
        email: formData.email,
        phone: formData.phone || null,
        child_age: parseInt(formData.child_age),
        interest: formData.interest,
        availability,
        message: formData.message || null,
        status: formData.status,
      })
      .eq('id', selectedBooking.id);

    if (error) {
      toast({ title: 'Errore', description: 'Impossibile aggiornare la prenotazione', variant: 'destructive' });
    } else {
      toast({ title: 'Successo', description: 'Prenotazione aggiornata' });
      setShowEditDialog(false);
      fetchBookings();
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedBooking) return;

    setIsSaving(true);
    const { error } = await supabase
      .from('trial_bookings')
      .delete()
      .eq('id', selectedBooking.id);

    if (error) {
      toast({ title: 'Errore', description: 'Impossibile eliminare la prenotazione', variant: 'destructive' });
    } else {
      toast({ title: 'Successo', description: 'Prenotazione eliminata' });
      setShowDeleteDialog(false);
      fetchBookings();
    }
    setIsSaving(false);
  };

  const pendingCount = bookings.filter(b => b.status === 'pending').length;

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const BookingFormFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Nome genitore *</label>
          <Input
            value={formData.parent_name}
            onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
            placeholder="Mario Rossi"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Email *</label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="mario@email.com"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Telefono</label>
          <Input
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+39 333 1234567"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Età bambino</label>
          <Select value={formData.child_age} onValueChange={(v) => setFormData({ ...formData, child_age: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 13 }, (_, i) => i + 6).map((age) => (
                <SelectItem key={age} value={String(age)}>{age} anni</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Interesse</label>
        <Select value={formData.interest} onValueChange={(v) => setFormData({ ...formData, interest: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {interests.map((i) => (
              <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Giorno preferito</label>
          <Select value={formData.preferred_day} onValueChange={(v) => setFormData({ ...formData, preferred_day: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Seleziona giorno" />
            </SelectTrigger>
            <SelectContent>
              {weekDays.map((day) => (
                <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Ora preferita</label>
          <Select value={formData.preferred_time} onValueChange={(v) => setFormData({ ...formData, preferred_time: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Seleziona ora" />
            </SelectTrigger>
            <SelectContent>
              {timeSlots.map((slot) => (
                <SelectItem key={slot.value} value={slot.value}>{slot.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Stato</label>
        <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as TrialBooking['status'] })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">In attesa</SelectItem>
            <SelectItem value="contacted">Contattato</SelectItem>
            <SelectItem value="scheduled">Programmato</SelectItem>
            <SelectItem value="completed">Completato</SelectItem>
            <SelectItem value="cancelled">Annullato</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Messaggio</label>
        <Textarea
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          placeholder="Note o richieste speciali..."
          rows={3}
        />
      </div>
    </div>
  );

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
            <Badge variant="secondary">Admin</Badge>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/area-riservata">
              <Button variant="outline" size="sm">
                <Home className="w-4 h-4 mr-2" />
                Area Riservata
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

      {/* Navigation */}
      <div className="border-b bg-background">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-4 overflow-x-auto">
            <Link to="/admin" className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap">
              <FileText className="w-4 h-4" />
              Blog
            </Link>
            <Link to="/admin/corsi" className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap">
              <GraduationCap className="w-4 h-4" />
              Corsi
            </Link>
            <Link to="/admin/prenotazioni" className="py-3 px-2 border-b-2 border-primary text-primary font-medium flex items-center gap-2 whitespace-nowrap">
              <BookOpen className="w-4 h-4" />
              Prenotazioni
              {pendingCount > 0 && <Badge variant="destructive" className="ml-1">{pendingCount}</Badge>}
            </Link>
            <Link to="/admin/contatti" className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap">
              <Mail className="w-4 h-4" />
              Contatti
            </Link>
            <Link to="/admin/utenti" className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap">
              <Users className="w-4 h-4" />
              Utenti
            </Link>
            <Link to="/admin/statistiche" className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap">
              <BarChart3 className="w-4 h-4" />
              Statistiche
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Prenotazioni Lezioni di Prova</h1>
            <p className="text-muted-foreground mt-1">
              {bookings.length} prenotazioni totali • {pendingCount} in attesa
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Nuova Prenotazione
          </Button>
        </div>

        {/* Bookings List */}
        {bookings.length === 0 ? (
          <div className="tech-card p-12 text-center">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nessuna prenotazione</h3>
            <p className="text-muted-foreground">Le nuove prenotazioni appariranno qui</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <Collapsible
                key={booking.id}
                open={expandedId === booking.id}
                onOpenChange={(open) => setExpandedId(open ? booking.id : null)}
              >
                <div className="tech-card overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <div className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold">{booking.parent_name}</h3>
                            <Badge 
                              variant={statusConfig[booking.status].variant}
                              className={booking.status === 'pending' ? 'bg-yellow-500 text-white' : ''}
                            >
                              {statusConfig[booking.status].label}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {booking.child_age} anni
                            </span>
                            <span>•</span>
                            <span>{interestLabels[booking.interest] || booking.interest}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(booking.created_at).toLocaleDateString('it-IT', { 
                                day: 'numeric', 
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${expandedId === booking.id ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="px-4 pb-4 border-t bg-muted/20">
                      <div className="grid md:grid-cols-2 gap-6 pt-4">
                        {/* Contact Info */}
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Contatto</h4>
                          <div className="space-y-2">
                            <a 
                              href={`mailto:${booking.email}`} 
                              className="flex items-center gap-2 text-primary hover:underline"
                            >
                              <Mail className="w-4 h-4" />
                              {booking.email}
                            </a>
                            {booking.phone && (
                              <a 
                                href={`tel:${booking.phone}`} 
                                className="flex items-center gap-2 text-primary hover:underline"
                              >
                                <Phone className="w-4 h-4" />
                                {booking.phone}
                              </a>
                            )}
                            {booking.availability && (
                              <p className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                Preferenza: {availabilityLabels[booking.availability] || booking.availability}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Status Update */}
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Stato</h4>
                          <Select 
                            value={booking.status} 
                            onValueChange={(value) => updateStatus(booking.id, value as 'pending' | 'contacted' | 'scheduled' | 'completed' | 'cancelled')}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">In attesa</SelectItem>
                              <SelectItem value="contacted">Contattato</SelectItem>
                              <SelectItem value="scheduled">Programmato</SelectItem>
                              <SelectItem value="completed">Completato</SelectItem>
                              <SelectItem value="cancelled">Annullato</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Message */}
                      {booking.message && (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Messaggio del genitore
                          </h4>
                          <p className="text-sm bg-background p-3 rounded-lg">{booking.message}</p>
                        </div>
                      )}

                      {/* Admin Notes */}
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-2">
                          Note Admin
                        </h4>
                        {editingNotes === booking.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={notesValue}
                              onChange={(e) => setNotesValue(e.target.value)}
                              placeholder="Aggiungi note..."
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => saveNotes(booking.id)}>
                                Salva
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingNotes(null)}>
                                Annulla
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="text-sm bg-background p-3 rounded-lg cursor-pointer hover:bg-muted/50 min-h-[60px]"
                            onClick={() => {
                              setEditingNotes(booking.id);
                              setNotesValue(booking.admin_notes || "");
                            }}
                          >
                            {booking.admin_notes || <span className="text-muted-foreground italic">Clicca per aggiungere note...</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </main>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuova Prenotazione</DialogTitle>
          </DialogHeader>
          <BookingFormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Annulla</Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crea'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Prenotazione</DialogTitle>
          </DialogHeader>
          <BookingFormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Annulla</Button>
            <Button onClick={handleEdit} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salva'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina prenotazione?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. La prenotazione di {selectedBooking?.parent_name} verrà eliminata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Elimina'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
