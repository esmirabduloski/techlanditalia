import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Loader2, User, BookOpen, Users, UsersRound, LogOut, Home, Phone, Mail, Clock,
  ChevronRight, GraduationCap, Plus, Trash2, Edit2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AvailabilitySlot {
  day: string;
  startTime: string;
  endTime: string;
}

interface TeacherProfile {
  id: string;
  user_id: string;
  phone: string | null;
  availability: AvailabilitySlot[] | null;
}

interface Course {
  id: string;
  title: string;
  emoji: string;
  total_lessons: number;
}

interface StudentGroup {
  id: string;
  title: string;
  course_id: string;
  course_title?: string;
  course_emoji?: string;
  start_date: string | null;
  last_lesson_title: string | null;
  max_lessons: number;
  student_count?: number;
}

const DAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const TIMES = Array.from({ length: 28 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const minutes = i % 2 === 0 ? "00" : "30";
  return `${hour.toString().padStart(2, "0")}:${minutes}`;
});

export default function TeacherDashboard() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isTeacher, setIsTeacher] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profilo");
  const [profile, setProfile] = useState<{ full_name: string; email: string | null } | null>(null);
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);
  const [assignedCourses, setAssignedCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingAvailability, setIsEditingAvailability] = useState(false);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);

  useEffect(() => {
    if (!authLoading && user) {
      checkTeacherRole();
    } else if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const checkTeacherRole = async () => {
    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id)
        .eq('role', 'teacher')
        .maybeSingle();

      if (!roleData) {
        toast({ title: 'Accesso negato', description: 'Non hai il ruolo di insegnante', variant: 'destructive' });
        navigate('/area-riservata');
        return;
      }

      setIsTeacher(true);
      await fetchData();
    } catch (error) {
      console.error("Error checking teacher role:", error);
      navigate('/area-riservata');
    }
  };

  const fetchData = async () => {
    try {
      // Fetch user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user!.id)
        .single();
      
      setProfile(profileData);

      // Fetch teacher profile
      const { data: teacherData } = await supabase
        .from('teacher_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (teacherData) {
        const parsedAvailability = Array.isArray(teacherData.availability) 
          ? (teacherData.availability as unknown as AvailabilitySlot[])
          : null;
        const parsedProfile: TeacherProfile = {
          id: teacherData.id,
          user_id: teacherData.user_id,
          phone: teacherData.phone,
          availability: parsedAvailability
        };
        setTeacherProfile(parsedProfile);
        setPhone(teacherData.phone || "");
        setAvailabilitySlots(parsedAvailability || []);
      }

      // Fetch assigned courses
      const { data: teacherCourses } = await supabase
        .from('teacher_courses')
        .select('course_id')
        .eq('teacher_id', user!.id);

      if (teacherCourses && teacherCourses.length > 0) {
        const courseIds = teacherCourses.map(tc => tc.course_id);
        const { data: coursesData } = await supabase
          .from('courses')
          .select('id, title, emoji, total_lessons')
          .in('id', courseIds);
        
        setAssignedCourses(coursesData || []);
      }

      // Fetch groups
      const { data: groupsData } = await supabase
        .from('student_groups')
        .select(`
          id, title, course_id, start_date, last_lesson_title, max_lessons,
          courses!inner(title, emoji)
        `)
        .eq('teacher_id', user!.id);

      if (groupsData) {
        // Get student counts for each group
        const groupsWithCounts = await Promise.all(
          groupsData.map(async (g: any) => {
            const { count } = await supabase
              .from('group_students')
              .select('*', { count: 'exact', head: true })
              .eq('group_id', g.id);
            
            return {
              id: g.id,
              title: g.title,
              course_id: g.course_id,
              course_title: g.courses?.title,
              course_emoji: g.courses?.emoji,
              start_date: g.start_date,
              last_lesson_title: g.last_lesson_title,
              max_lessons: g.max_lessons,
              student_count: count || 0
            };
          })
        );
        setGroups(groupsWithCounts);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePhone = async () => {
    setIsSaving(true);
    try {
      if (teacherProfile) {
        await supabase
          .from('teacher_profiles')
          .update({ phone })
          .eq('user_id', user!.id);
      } else {
        await supabase
          .from('teacher_profiles')
          .insert({ user_id: user!.id, phone });
      }
      toast({ title: 'Salvato', description: 'Telefono aggiornato' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const addAvailabilitySlot = () => {
    setAvailabilitySlots([...availabilitySlots, { day: "Lunedì", startTime: "09:00", endTime: "10:00" }]);
  };

  const removeAvailabilitySlot = (index: number) => {
    setAvailabilitySlots(availabilitySlots.filter((_, i) => i !== index));
  };

  const updateAvailabilitySlot = (index: number, field: keyof AvailabilitySlot, value: string) => {
    const updated = [...availabilitySlots];
    updated[index] = { ...updated[index], [field]: value };
    setAvailabilitySlots(updated);
  };

  const handleSaveAvailability = async () => {
    setIsSaving(true);
    try {
      const availabilityData = availabilitySlots.map(slot => ({
        day: slot.day,
        startTime: slot.startTime,
        endTime: slot.endTime
      }));
      
      if (teacherProfile) {
        await supabase
          .from('teacher_profiles')
          .update({ availability: availabilityData as unknown as any })
          .eq('user_id', user!.id);
      } else {
        await supabase
          .from('teacher_profiles')
          .insert([{ user_id: user!.id, availability: availabilityData as unknown as any }]);
      }
      toast({ title: 'Salvato', description: 'Disponibilità aggiornata' });
      setIsEditingAvailability(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEditAvailability = () => {
    setAvailabilitySlots(teacherProfile?.availability || []);
    setIsEditingAvailability(false);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isTeacher) return null;

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
            <Badge className="bg-tech-teal text-white">Insegnante</Badge>
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-tech-teal" />
            Dashboard Insegnante
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci i tuoi corsi, gruppi e studenti
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profilo" className="gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Profilo</span>
            </TabsTrigger>
            <TabsTrigger value="corsi" className="gap-2">
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Corsi</span>
            </TabsTrigger>
            <TabsTrigger value="studenti" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Studenti</span>
            </TabsTrigger>
            <TabsTrigger value="gruppi" className="gap-2">
              <UsersRound className="w-4 h-4" />
              <span className="hidden sm:inline">Gruppi</span>
            </TabsTrigger>
          </TabsList>

          {/* Profilo Tab */}
          <TabsContent value="profilo" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Informazioni Personali
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      Nome Completo
                    </label>
                    <Input value={profile?.full_name || ""} disabled />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      Email
                    </label>
                    <Input value={profile?.email || ""} disabled />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      Telefono
                    </label>
                    <div className="flex gap-2">
                      <Input 
                        value={phone} 
                        onChange={(e) => setPhone(e.target.value)} 
                        placeholder="+39 xxx xxx xxxx"
                      />
                      <Button onClick={handleSavePhone} disabled={isSaving}>
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salva'}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-medium mb-4 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                    Corsi Abilitati
                  </h4>
                  {assignedCourses.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nessun corso assegnato</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {assignedCourses.map(course => (
                        <Badge key={course.id} variant="secondary" className="text-sm">
                          {course.emoji} {course.title}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      Orari di Disponibilità
                    </h4>
                    {!isEditingAvailability ? (
                      <Button variant="outline" size="sm" onClick={() => setIsEditingAvailability(true)}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        Modifica
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={cancelEditAvailability}>
                          Annulla
                        </Button>
                        <Button size="sm" onClick={handleSaveAvailability} disabled={isSaving}>
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salva'}
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {isEditingAvailability ? (
                    <div className="space-y-3">
                      {availabilitySlots.map((slot, index) => (
                        <div key={index} className="flex items-center gap-2 flex-wrap">
                          <Select value={slot.day} onValueChange={(v) => updateAvailabilitySlot(index, 'day', v)}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS.map(d => (
                                <SelectItem key={d} value={d}>{d}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={slot.startTime} onValueChange={(v) => updateAvailabilitySlot(index, 'startTime', v)}>
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIMES.map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-muted-foreground">-</span>
                          <Select value={slot.endTime} onValueChange={(v) => updateAvailabilitySlot(index, 'endTime', v)}>
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIMES.map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" onClick={() => removeAvailabilitySlot(index)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={addAvailabilitySlot}>
                        <Plus className="w-4 h-4 mr-2" />
                        Aggiungi Orario
                      </Button>
                    </div>
                  ) : (
                    teacherProfile?.availability && teacherProfile.availability.length > 0 ? (
                      <div className="space-y-2">
                        {teacherProfile.availability.map((slot, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <Badge variant="secondary" className="min-w-20">{slot.day}</Badge>
                            <span className="text-muted-foreground">{slot.startTime} - {slot.endTime}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        Nessun orario configurato. Clicca "Modifica" per aggiungere i tuoi orari.
                      </p>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Corsi Tab */}
          <TabsContent value="corsi" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Corsi Assegnati</CardTitle>
              </CardHeader>
              <CardContent>
                {assignedCourses.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nessun corso assegnato</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">ID</TableHead>
                        <TableHead>Titolo</TableHead>
                        <TableHead className="text-center">Lezioni</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignedCourses.map(course => (
                        <TableRow 
                          key={course.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/insegnante/corso/${course.id}`)}
                        >
                          <TableCell className="font-mono text-xs">
                            {course.id.substring(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <span className="mr-2">{course.emoji}</span>
                            {course.title}
                          </TableCell>
                          <TableCell className="text-center">{course.total_lessons}</TableCell>
                          <TableCell>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Studenti Tab */}
          <TabsContent value="studenti" className="space-y-6">
            <TeacherStudentsList groups={groups} />
          </TabsContent>

          {/* Gruppi Tab */}
          <TabsContent value="gruppi" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Gruppi Assegnati</CardTitle>
              </CardHeader>
              <CardContent>
                {groups.length === 0 ? (
                  <div className="text-center py-8">
                    <UsersRound className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nessun gruppo assegnato</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">ID</TableHead>
                        <TableHead>Titolo</TableHead>
                        <TableHead>Corso</TableHead>
                        <TableHead>Data Inizio</TableHead>
                        <TableHead className="text-center">Studenti</TableHead>
                        <TableHead>Ultima Lezione</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groups.map(group => (
                        <TableRow 
                          key={group.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/insegnante/gruppo/${group.id}`)}
                        >
                          <TableCell className="font-mono text-xs">
                            {group.id.substring(0, 8)}...
                          </TableCell>
                          <TableCell className="font-medium">{group.title}</TableCell>
                          <TableCell>
                            <span className="mr-1">{group.course_emoji}</span>
                            {group.course_title}
                          </TableCell>
                          <TableCell>
                            {group.start_date ? new Date(group.start_date).toLocaleDateString('it-IT') : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{group.student_count}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {group.last_lesson_title || '-'}
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// Component for students list
function TeacherStudentsList({ groups }: { groups: StudentGroup[] }) {
  const navigate = useNavigate();
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
  }, [groups]);

  const fetchStudents = async () => {
    if (groups.length === 0) {
      setIsLoading(false);
      return;
    }

    try {
      const groupIds = groups.map(g => g.id);
      const { data: groupStudentsData } = await supabase
        .from('group_students')
        .select(`
          student_id,
          group_id,
          profiles!inner(id, full_name, email, avatar_id, total_points)
        `)
        .in('group_id', groupIds);

      if (groupStudentsData) {
        // Deduplicate students and add group info
        const studentMap = new Map();
        groupStudentsData.forEach((gs: any) => {
          const group = groups.find(g => g.id === gs.group_id);
          if (!studentMap.has(gs.student_id)) {
            studentMap.set(gs.student_id, {
              ...gs.profiles,
              groups: [{ id: group?.id, title: group?.title, course_title: group?.course_title }]
            });
          } else {
            studentMap.get(gs.student_id).groups.push({
              id: group?.id,
              title: group?.title,
              course_title: group?.course_title
            });
          }
        });
        setStudents(Array.from(studentMap.values()));
      }
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>I Miei Studenti</CardTitle>
      </CardHeader>
      <CardContent>
        {students.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nessuno studente nei tuoi gruppi</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Gruppi</TableHead>
                <TableHead className="text-center">Punti</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map(student => (
                <TableRow 
                  key={student.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/insegnante/studente/${student.id}`)}
                >
                  <TableCell className="font-medium">{student.full_name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {student.groups.map((g: any, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {g.title}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{student.total_points}</Badge>
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
