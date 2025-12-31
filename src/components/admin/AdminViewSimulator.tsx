import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, User, Users, GraduationCap } from "lucide-react";
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

export function AdminViewSimulator() {
  const { user, isAdmin } = useAuth();
  const [viewMode, setViewMode] = useState<'student' | 'parent'>('student');
  const [students, setStudents] = useState<Student[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
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

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-card to-primary/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary" />
          <CardTitle>Simulatore Vista</CardTitle>
        </div>
        <CardDescription>
          Visualizza come appare la dashboard per studenti e genitori
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={viewMode} onValueChange={(v) => {
          setViewMode(v as 'student' | 'parent');
          if (v === 'student' && students.length > 0) {
            setSelectedUserId(students[0].id);
          } else if (v === 'parent' && parents.length > 0) {
            setSelectedUserId(parents[0].id);
          }
        }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="student" className="gap-2">
              <GraduationCap className="w-4 h-4" />
              Vista Studente
            </TabsTrigger>
            <TabsTrigger value="parent" className="gap-2">
              <Users className="w-4 h-4" />
              Vista Genitore
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
        </Tabs>
      </CardContent>
    </Card>
  );
}
