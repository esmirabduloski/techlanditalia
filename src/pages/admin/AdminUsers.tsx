import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AdminNav } from '@/components/admin/AdminNav';
import { 
  LogOut,
  Loader2,
  Users,
  ChevronDown,
  ChevronRight,
  Shield,
  User,
  GraduationCap,
  Key,
  Plus,
  Home,
  Edit2,
  Search,
  MessageCircle
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";

interface Profile {
  id: string;
  full_name: string;
  role: 'student' | 'parent';
  parent_id: string | null;
  avatar_id: number;
  total_points: number;
  created_at: string;
  email?: string;
  isAdmin?: boolean;
  username?: string | null;
}

interface Course {
  id: string;
  title: string;
  emoji: string;
}

interface Enrollment {
  id: string;
  course_id: string;
  student_id: string;
  status: string;
}

export default function AdminUsers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [passwordDialog, setPasswordDialog] = useState<{ open: boolean; userId: string; userName: string }>({ open: false, userId: '', userName: '' });
  const [newPassword, setNewPassword] = useState('');
  const [courseDialog, setCourseDialog] = useState<{ open: boolean; userId: string; userName: string }>({ open: false, userId: '', userName: '' });
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editingChild, setEditingChild] = useState<{ id: string; username: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'parent' | 'student'>('all');
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
      fetchData();
    }
  }, [user, isAdmin]);

  const fetchData = async () => {
    setIsLoading(true);
    
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      toast({ title: 'Errore', description: 'Impossibile caricare i profili', variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .eq('role', 'admin');

    const adminIds = new Set(rolesData?.map(r => r.user_id) || []);

    const { data: coursesData } = await supabase
      .from('courses')
      .select('id, title, emoji');

    const { data: enrollmentsData } = await supabase
      .from('enrollments')
      .select('id, course_id, student_id, status');

    const enrichedProfiles = (profilesData || []).map(p => ({
      ...p,
      isAdmin: adminIds.has(p.id)
    })) as Profile[];

    setProfiles(enrichedProfiles);
    setCourses(coursesData || []);
    setEnrollments(enrollmentsData || []);
    setIsLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  // Filter profiles based on search and role filter
  const matchesSearchQuery = (p: Profile) => {
    if (searchQuery === '') return true;
    const query = searchQuery.toLowerCase();
    return p.full_name.toLowerCase().includes(query) ||
      (p.username && p.username.toLowerCase().includes(query));
  };

  const groupedUsers = () => {
    const groups: { parent: Profile | null; children: Profile[] }[] = [];
    
    // Get all parents
    const allParents = profiles.filter(p => p.role === 'parent');
    // Get all students
    const allStudents = profiles.filter(p => p.role === 'student');
    
    // For each parent, get their children
    allParents.forEach(parent => {
      const children = allStudents.filter(s => s.parent_id === parent.id);
      
      // Check if parent matches filter
      const parentMatchesSearch = matchesSearchQuery(parent);
      const parentMatchesRole = filterRole === 'all' || filterRole === 'parent';
      
      // Check if any child matches filter
      const matchingChildren = children.filter(c => {
        const childMatchesSearch = matchesSearchQuery(c);
        const childMatchesRole = filterRole === 'all' || filterRole === 'student';
        return childMatchesSearch && childMatchesRole;
      });
      
      // Include parent if:
      // 1. Parent matches search and role filter, OR
      // 2. Any child matches search and we're not filtering only parents
      const shouldIncludeParent = (parentMatchesSearch && parentMatchesRole) || 
        (matchingChildren.length > 0 && filterRole !== 'parent');
      
      if (shouldIncludeParent) {
        // If searching, only show matching children. Otherwise show all children.
        const childrenToShow = searchQuery === '' && filterRole === 'all' 
          ? children 
          : matchingChildren.length > 0 ? matchingChildren : (parentMatchesSearch ? children : []);
        groups.push({ parent, children: childrenToShow });
      }
    });
    
    // Orphan students (no parent)
    if (filterRole !== 'parent') {
      const orphanStudents = allStudents.filter(s => {
        if (s.parent_id) return false;
        return matchesSearchQuery(s);
      });
      if (orphanStudents.length > 0) {
        groups.push({ parent: null, children: orphanStudents });
      }
    }
    
    return groups;
  };

  const toggleFamily = (parentId: string) => {
    const newExpanded = new Set(expandedFamilies);
    if (newExpanded.has(parentId)) {
      newExpanded.delete(parentId);
    } else {
      newExpanded.add(parentId);
    }
    setExpandedFamilies(newExpanded);
  };

  const openPasswordDialog = (userId: string, userName: string) => {
    setNewPassword('');
    setPasswordDialog({ open: true, userId, userName });
  };

  const handleSetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: 'Errore', description: 'La password deve avere almeno 6 caratteri', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-set-password', {
        body: { userId: passwordDialog.userId, newPassword }
      });

      if (error) throw error;

      toast({ title: 'Successo', description: 'Password aggiornata' });
      setPasswordDialog({ open: false, userId: '', userName: '' });
      fetchData(); // Refresh to show updated password
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message || 'Impossibile aggiornare la password', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const openCourseDialog = (userId: string, userName: string) => {
    const userEnrollments = enrollments.filter(e => e.student_id === userId);
    setSelectedCourses(userEnrollments.map(e => e.course_id));
    setCourseDialog({ open: true, userId, userName });
  };

  const handleSaveCourses = async () => {
    setIsSaving(true);
    try {
      const currentEnrollments = enrollments.filter(e => e.student_id === courseDialog.userId);
      const currentCourseIds = currentEnrollments.map(e => e.course_id);
      
      const toAdd = selectedCourses.filter(c => !currentCourseIds.includes(c));
      const toRemove = currentCourseIds.filter(c => !selectedCourses.includes(c));

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('enrollments')
          .delete()
          .eq('student_id', courseDialog.userId)
          .in('course_id', toRemove);
        if (error) throw error;
      }

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('enrollments')
          .insert(toAdd.map(courseId => ({
            student_id: courseDialog.userId,
            course_id: courseId,
            status: 'active'
          })));
        if (error) throw error;
      }

      toast({ title: 'Successo', description: 'Corsi aggiornati' });
      setCourseDialog({ open: false, userId: '', userName: '' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message || 'Impossibile aggiornare i corsi', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const updateProfileRole = async (profileId: string, newRole: 'student' | 'parent') => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', profileId);

    if (error) {
      toast({ title: 'Errore', description: 'Impossibile aggiornare il ruolo', variant: 'destructive' });
    } else {
      setProfiles(profiles.map(p => p.id === profileId ? { ...p, role: newRole } : p));
      toast({ title: 'Successo', description: 'Ruolo aggiornato' });
    }
  };

  const toggleAdminRole = async (userId: string, currentlyAdmin: boolean) => {
    try {
      if (currentlyAdmin) {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'admin');
        if (error) throw error;
      } else {
        const { error } = await supabase.functions.invoke('admin-toggle-role', {
          body: { userId, action: 'add' }
        });
        if (error) throw error;
      }

      setProfiles(profiles.map(p => p.id === userId ? { ...p, isAdmin: !currentlyAdmin } : p));
      toast({ title: 'Successo', description: currentlyAdmin ? 'Admin rimosso' : 'Admin aggiunto' });
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message || 'Impossibile modificare il ruolo admin', variant: 'destructive' });
    }
  };

  const getUserEnrollments = (userId: string) => {
    return enrollments
      .filter(e => e.student_id === userId)
      .map(e => courses.find(c => c.id === e.course_id))
      .filter(Boolean) as Course[];
  };

  const openEditChildDialog = (child: Profile) => {
    setEditingChild({
      id: child.id,
      username: child.username || '',
    });
  };

  const handleSaveChildCredentials = async () => {
    if (!editingChild) return;
    
    setIsSaving(true);
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          username: editingChild.username,
        })
        .eq('id', editingChild.id);

      if (profileError) throw profileError;

      toast({ title: 'Successo', description: 'Username aggiornato' });
      setEditingChild(null);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message || 'Impossibile aggiornare le credenziali', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const groups = groupedUsers();

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
      <AdminNav />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Gestione Utenti</h1>
            <p className="text-muted-foreground mt-1">
              {profiles.length} utenti registrati
            </p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per nome o username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterRole} onValueChange={(v) => setFilterRole(v as 'all' | 'parent' | 'student')}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filtra per ruolo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              <SelectItem value="parent">Genitori</SelectItem>
              <SelectItem value="student">Studenti</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Users List */}
        <div className="space-y-4">
          {groups.length === 0 ? (
            <div className="tech-card p-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nessun utente trovato</h3>
              <p className="text-muted-foreground">Prova a modificare i filtri di ricerca</p>
            </div>
          ) : (
            groups.map((group, idx) => {
              const familyId = group.parent?.id || `orphans-${idx}`;
              const isExpanded = expandedFamilies.has(familyId);
              const hasChildren = group.children.length > 0;

              return (
                <div key={familyId} className="tech-card overflow-hidden">
                  {/* Parent Row */}
                  {group.parent ? (
                    <Collapsible open={isExpanded} onOpenChange={() => toggleFamily(familyId)}>
                      <CollapsibleTrigger asChild>
                        <div className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              {hasChildren ? (
                                isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                              ) : (
                                <div className="w-5" />
                              )}
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <User className="w-5 h-5 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold truncate">{group.parent.full_name}</h3>
                                  <Badge variant="secondary">Genitore</Badge>
                                  {group.parent.isAdmin && <Badge className="bg-amber-500">Admin</Badge>}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                                  <span>{hasChildren ? `${group.children.length} ${group.children.length === 1 ? 'figlio' : 'figli'}` : 'Nessun figlio associato'}</span>
                                  {group.parent.email && (
                                    <>
                                      <span className="hidden sm:inline">•</span>
                                      <span className="text-xs">{group.parent.email}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  navigate(`/admin/commenti?parent_id=${group.parent!.id}&visibility=parent_only`); 
                                }}
                                title="Aggiungi commento (visibile solo al genitore)"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openPasswordDialog(group.parent!.id, group.parent!.full_name); }}>
                                <Key className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant={group.parent.isAdmin ? "destructive" : "outline"} 
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); toggleAdminRole(group.parent!.id, group.parent!.isAdmin || false); }}
                              >
                                <Shield className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        {group.children.map(child => (
                          <div key={child.id} className="px-4 py-3 border-t bg-muted/20 ml-8">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-8 h-8 rounded-full bg-tech-teal/20 flex items-center justify-center flex-shrink-0">
                                  <GraduationCap className="w-4 h-4 text-tech-teal" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-medium truncate">{child.full_name}</h4>
                                    <Badge variant="outline" className="text-xs">Studente</Badge>
                                    <Badge variant="secondary" className="text-xs">{child.total_points} punti</Badge>
                                  </div>
                                  
                                  <div className="flex items-center gap-4 mt-1 text-sm">
                                    {child.username && (
                                      <span className="text-muted-foreground">
                                        <span className="font-medium">Username:</span> {child.username}
                                      </span>
                                    )}
                                    <span className="text-muted-foreground text-xs">
                                      (usa la password del genitore)
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center gap-1 flex-wrap mt-1">
                                    {getUserEnrollments(child.id).map(course => (
                                      <Badge key={course.id} variant="secondary" className="text-xs">
                                        {course.emoji} {course.title}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => navigate(`/admin/commenti?student_id=${child.id}`)}
                                  title="Aggiungi commento"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => openEditChildDialog(child)}>
                                  <Edit2 className="w-4 h-4 mr-1" />
                                  Modifica
                                </Button>
                              <Button variant="outline" size="sm" onClick={() => openCourseDialog(child.id, child.full_name)}>
                                  <Plus className="w-4 h-4 mr-1" />
                                  Corsi
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {!hasChildren && (
                          <div className="px-4 py-3 border-t bg-muted/20 ml-8 text-sm text-muted-foreground">
                            Nessun figlio associato a questo genitore
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    // Orphan students
                    <div>
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border-b">
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Studenti senza genitore associato
                        </p>
                      </div>
                      {group.children.map(child => (
                        <div key={child.id} className="px-4 py-3 border-t">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-full bg-tech-teal/20 flex items-center justify-center flex-shrink-0">
                                <GraduationCap className="w-4 h-4 text-tech-teal" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-medium truncate">{child.full_name}</h4>
                                  <Badge variant="outline" className="text-xs">Studente</Badge>
                                  <Badge variant="secondary" className="text-xs">{child.total_points} punti</Badge>
                                  {child.isAdmin && <Badge className="bg-amber-500 text-xs">Admin</Badge>}
                                </div>
                                
                                <div className="flex items-center gap-4 mt-1 text-sm">
                                  {child.username && (
                                    <span className="text-muted-foreground">
                                      <span className="font-medium">Username:</span> {child.username}
                                    </span>
                                  )}
                                  <span className="text-muted-foreground text-xs">
                                    (usa la password del genitore)
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-1 flex-wrap mt-1">
                                  {getUserEnrollments(child.id).map(course => (
                                    <Badge key={course.id} variant="secondary" className="text-xs">
                                      {course.emoji} {course.title}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => navigate(`/admin/commenti?student_id=${child.id}`)}
                                title="Aggiungi commento"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </Button>
                              <Select 
                                value={child.role} 
                                onValueChange={(v) => updateProfileRole(child.id, v as 'student' | 'parent')}
                              >
                                <SelectTrigger className="w-28 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="student">Studente</SelectItem>
                                  <SelectItem value="parent">Genitore</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button variant="outline" size="sm" onClick={() => openEditChildDialog(child)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openCourseDialog(child.id, child.full_name)}>
                                <Plus className="w-4 h-4 mr-1" />
                                Corsi
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Password Dialog */}
      <Dialog open={passwordDialog.open} onOpenChange={(open) => !open && setPasswordDialog({ open: false, userId: '', userName: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Imposta Password - {passwordDialog.userName}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label>Nuova Password</Label>
            <PasswordInput
              placeholder="Nuova password (min. 6 caratteri)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Questa password verrà applicata anche a tutti i figli associati a questo genitore.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialog({ open: false, userId: '', userName: '' })}>
              Annulla
            </Button>
            <Button onClick={handleSetPassword} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Imposta Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Course Assignment Dialog */}
      <Dialog open={courseDialog.open} onOpenChange={(open) => !open && setCourseDialog({ open: false, userId: '', userName: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assegna Corsi - {courseDialog.userName}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {courses.map(course => (
              <div key={course.id} className="flex items-center gap-3">
                <Checkbox
                  id={course.id}
                  checked={selectedCourses.includes(course.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedCourses([...selectedCourses, course.id]);
                    } else {
                      setSelectedCourses(selectedCourses.filter(c => c !== course.id));
                    }
                  }}
                />
                <label htmlFor={course.id} className="flex items-center gap-2 cursor-pointer">
                  <span>{course.emoji}</span>
                  <span>{course.title}</span>
                </label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseDialog({ open: false, userId: '', userName: '' })}>
              Annulla
            </Button>
            <Button onClick={handleSaveCourses} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salva Corsi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Child Credentials Dialog */}
      <Dialog open={!!editingChild} onOpenChange={(open) => !open && setEditingChild(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Credenziali Studente</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">Nome Utente</Label>
              <Input
                id="edit-username"
                value={editingChild?.username || ''}
                onChange={(e) => setEditingChild(prev => prev ? { ...prev, username: e.target.value } : null)}
                placeholder="Username per il login"
              />
            </div>
            <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
              Lo studente usa la stessa password del genitore. Per cambiare la password, usa il pulsante "Password" sul genitore.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingChild(null)}>
              Annulla
            </Button>
            <Button onClick={handleSaveChildCredentials} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salva'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
