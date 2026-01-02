import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Eye, User, Users, GraduationCap, BookOpen, UsersRound, Phone, Mail, Clock, ChevronRight } from "lucide-react";
import { BadgesDisplay } from "@/components/gamification/BadgesDisplay";
import { LevelBadge, PointsDisplay, getLevelFromPoints } from "@/components/gamification/LevelBadge";
import { AvatarDisplay } from "@/components/gamification/AvatarSelector";
import { StudentCommentsSection } from "@/components/dashboard/StudentCommentsSection";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Student {
  id: string;
  full_name: string;
  email: string | null;
  avatar_id: number;
  total_points: number;
  role: string;
  parent_id: string | null;
}

interface Parent {
  id: string;
  full_name: string;
  email: string | null;
  children: Student[];
}

interface Teacher {
  id: string;
  full_name: string;
  email: string | null;
  phone?: string | null;
  availability?: { day: string; startTime: string; endTime: string }[];
  courses: { id: string; title: string; emoji: string; total_lessons: number }[];
  groups: { id: string; title: string; course_title: string; student_count: number }[];
}

export function AdminViewSimulator() {
  const { user, isAdmin } = useAuth();
  const [viewMode, setViewMode] = useState<'student' | 'parent' | 'teacher'>('student');
  const [students, setStudents] = useState<Student[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && isAdmin) {
      fetchData();
    }
  }, [user, isAdmin]);

  const fetchData = async () => {
    try {
      // Fetch all students
      const { data: studentsData } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_id, total_points, role, parent_id')
        .eq('role', 'student')
        .order('full_name');

      setStudents(studentsData || []);

      // Fetch all parents
      const { data: parentsData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'parent')
        .order('full_name');

      // For each parent, find their children
      const parentsWithChildren: Parent[] = (parentsData || []).map(parent => ({
        ...parent,
        children: (studentsData || []).filter(s => s.parent_id === parent.id),
      }));

      setParents(parentsWithChildren);

      // Fetch all teachers
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'teacher');

      if (rolesData && rolesData.length > 0) {
        const teacherIds = rolesData.map(r => r.user_id);
        
        const { data: teacherProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', teacherIds)
          .order('full_name');

        const teachersWithData: Teacher[] = await Promise.all(
          (teacherProfiles || []).map(async (tp) => {
            // Get phone and availability from teacher_profiles
            const { data: tpData } = await supabase
              .from('teacher_profiles')
              .select('phone, availability')
              .eq('user_id', tp.id)
              .maybeSingle();

            // Get assigned courses
            const { data: tcData } = await supabase
              .from('teacher_courses')
              .select('course_id')
              .eq('teacher_id', tp.id);

            let courses: any[] = [];
            if (tcData && tcData.length > 0) {
              const { data: coursesData } = await supabase
                .from('courses')
                .select('id, title, emoji, total_lessons')
                .in('id', tcData.map(tc => tc.course_id));
              courses = coursesData || [];
            }

            // Get groups
            const { data: groupsData } = await supabase
              .from('student_groups')
              .select(`id, title, courses!inner(title)`)
              .eq('teacher_id', tp.id);

            const groups = await Promise.all(
              (groupsData || []).map(async (g: any) => {
                const { count } = await supabase
                  .from('group_students')
                  .select('*', { count: 'exact', head: true })
                  .eq('group_id', g.id);
                return {
                  id: g.id,
                  title: g.title,
                  course_title: g.courses?.title,
                  student_count: count || 0
                };
              })
            );

            return {
              id: tp.id,
              full_name: tp.full_name,
              email: tp.email,
              phone: tpData?.phone,
              availability: Array.isArray(tpData?.availability) ? tpData.availability as unknown as { day: string; startTime: string; endTime: string }[] : [],
              courses,
              groups
            };
          })
        );

        setTeachers(teachersWithData);
      }
      
      if (studentsData && studentsData.length > 0) {
        setSelectedUserId(studentsData[0].id);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin) return null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const selectedStudent = students.find(s => s.id === selectedUserId);
  const selectedParent = parents.find(p => p.id === selectedUserId);
  const selectedTeacher = teachers.find(t => t.id === selectedUserId);

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-card to-primary/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary" />
          <CardTitle>Simulatore Vista</CardTitle>
        </div>
        <CardDescription>
          Visualizza come appare la dashboard per studenti, genitori e insegnanti
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={viewMode} onValueChange={(v) => {
          setViewMode(v as 'student' | 'parent' | 'teacher');
          if (v === 'student' && students.length > 0) {
            setSelectedUserId(students[0].id);
          } else if (v === 'parent' && parents.length > 0) {
            setSelectedUserId(parents[0].id);
          } else if (v === 'teacher' && teachers.length > 0) {
            setSelectedUserId(teachers[0].id);
          }
        }}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="student" className="gap-2">
              <GraduationCap className="w-4 h-4" />
              <span className="hidden sm:inline">Studente</span>
            </TabsTrigger>
            <TabsTrigger value="parent" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Genitore</span>
            </TabsTrigger>
            <TabsTrigger value="teacher" className="gap-2">
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Insegnante</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="student" className="space-y-4 mt-4">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona studente" />
              </SelectTrigger>
              <SelectContent>
                {students.map(student => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.full_name} ({student.total_points} punti)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedStudent && (
              <div className="space-y-6 mt-4 p-4 border rounded-lg bg-background">
                <div className="flex items-center gap-4">
                  <AvatarDisplay 
                    avatarId={selectedStudent.avatar_id} 
                    level={getLevelFromPoints(selectedStudent.total_points).level} 
                    size="lg" 
                  />
                  <div>
                    <h3 className="text-xl font-bold">{selectedStudent.full_name}</h3>
                    <LevelBadge points={selectedStudent.total_points} size="md" showProgress />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Punti Totali</p>
                      <PointsDisplay points={selectedStudent.total_points} size="lg" />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Livello</p>
                      <p className="text-2xl font-bold">
                        {getLevelFromPoints(selectedStudent.total_points).level}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <BadgesDisplay userId={selectedStudent.id} showAll={true} />
                
                <StudentCommentsSection studentId={selectedStudent.id} viewMode="student" />
              </div>
            )}
          </TabsContent>

          <TabsContent value="parent" className="space-y-4 mt-4">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona genitore" />
              </SelectTrigger>
              <SelectContent>
                {parents.map(parent => (
                  <SelectItem key={parent.id} value={parent.id}>
                    {parent.full_name} ({parent.children.length} figli)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedParent && (
              <div className="space-y-6 mt-4 p-4 border rounded-lg bg-background">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{selectedParent.full_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedParent.children.length} {selectedParent.children.length === 1 ? 'figlio' : 'figli'} registrati
                    </p>
                  </div>
                </div>

                {selectedParent.children.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                      <Users className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">
                        Nessun figlio collegato a questo genitore
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {selectedParent.children.map(child => (
                      <div key={child.id} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center gap-4">
                          <AvatarDisplay 
                            avatarId={child.avatar_id} 
                            level={getLevelFromPoints(child.total_points).level} 
                            size="md" 
                          />
                          <div>
                            <h4 className="font-semibold">{child.full_name}</h4>
                            <LevelBadge points={child.total_points} size="sm" showProgress />
                          </div>
                          <Badge variant="outline" className="ml-auto">
                            {child.total_points} punti
                          </Badge>
                        </div>
                        
                        <BadgesDisplay 
                          userId={child.id} 
                          showAll={true} 
                          maxItems={8}
                          title={`Badge di ${child.full_name}`} 
                        />
                        
                        <StudentCommentsSection studentId={child.id} viewMode="parent" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="teacher" className="space-y-4 mt-4">
            {teachers.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">
                    Nessun insegnante configurato
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona insegnante" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map(teacher => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.full_name} ({teacher.courses.length} corsi, {teacher.groups.length} gruppi)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedTeacher && (
                  <div className="space-y-6 mt-4 p-4 border rounded-lg bg-background">
                    {/* Profile Section */}
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-tech-teal/10 flex items-center justify-center">
                        <GraduationCap className="w-6 h-6 text-tech-teal" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{selectedTeacher.full_name}</h3>
                        <Badge className="bg-tech-teal text-white">Insegnante</Badge>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedTeacher.email || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedTeacher.phone || 'Non configurato'}</span>
                      </div>
                    </div>

                    {/* Courses Section */}
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Corsi Assegnati ({selectedTeacher.courses.length})
                      </h4>
                      {selectedTeacher.courses.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nessun corso assegnato</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {selectedTeacher.courses.map(course => (
                            <Badge key={course.id} variant="secondary">
                              {course.emoji} {course.title} ({course.total_lessons} lezioni)
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Availability Section */}
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Disponibilità Oraria
                      </h4>
                      {selectedTeacher.availability && selectedTeacher.availability.length > 0 ? (
                        <div className="space-y-2">
                          {selectedTeacher.availability.map((slot, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <Badge variant="secondary" className="min-w-20">{slot.day}</Badge>
                              <span className="text-muted-foreground">{slot.startTime} - {slot.endTime}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nessun orario configurato</p>
                      )}
                    </div>

                    {/* Groups Section */}
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <UsersRound className="w-4 h-4" />
                        Gruppi Assegnati ({selectedTeacher.groups.length})
                      </h4>
                      {selectedTeacher.groups.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nessun gruppo assegnato</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Gruppo</TableHead>
                              <TableHead>Corso</TableHead>
                              <TableHead className="text-center">Studenti</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedTeacher.groups.map(group => (
                              <TableRow key={group.id}>
                                <TableCell className="font-medium">{group.title}</TableCell>
                                <TableCell>{group.course_title}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline">{group.student_count}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}