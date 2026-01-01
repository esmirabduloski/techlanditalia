import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AdminNav } from "@/components/admin/AdminNav";
import { 
  Loader2, Eye, User, Users, GraduationCap, LogOut, Search, Home 
} from "lucide-react";
import { BadgesDisplay } from "@/components/gamification/BadgesDisplay";
import { LevelBadge, PointsDisplay, getLevelFromPoints } from "@/components/gamification/LevelBadge";
import { AvatarDisplay } from "@/components/gamification/AvatarSelector";
import { StudentCommentsSection } from "@/components/dashboard/StudentCommentsSection";

interface Student {
  id: string;
  full_name: string;
  email: string | null;
  avatar_id: number;
  total_points: number;
  role: string;
  parent_id: string | null;
  username: string | null;
}

interface Parent {
  id: string;
  full_name: string;
  email: string | null;
  children: Student[];
}

export default function AdminSimulator() {
  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [viewMode, setViewMode] = useState<'student' | 'parent'>('student');
  const [students, setStudents] = useState<Student[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
    try {
      // Fetch all students
      const { data: studentsData } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_id, total_points, role, parent_id, username')
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  // Filter students by username
  const filteredStudents = students.filter(s => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (s.username?.toLowerCase().includes(query)) || 
           s.full_name.toLowerCase().includes(query);
  });

  // Filter parents by email
  const filteredParents = parents.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (p.email?.toLowerCase().includes(query)) || 
           p.full_name.toLowerCase().includes(query);
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const selectedStudent = students.find(s => s.id === selectedUserId);
  const selectedParent = parents.find(p => p.id === selectedUserId);

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
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Eye className="w-8 h-8 text-primary" />
            Simulatore Vista
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualizza come appare la dashboard per studenti e genitori
          </p>
        </div>

        <Card className="border-primary/30 bg-gradient-to-br from-card to-primary/5">
          <CardContent className="pt-6 space-y-4">
            <Tabs value={viewMode} onValueChange={(v) => {
              setViewMode(v as 'student' | 'parent');
              setSearchQuery('');
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
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Cerca per username..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Seleziona studente" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredStudents.map(student => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.full_name} {student.username && `(@${student.username})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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
                        {selectedStudent.username && (
                          <p className="text-sm text-muted-foreground">@{selectedStudent.username}</p>
                        )}
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
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Cerca per email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Seleziona genitore" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredParents.map(parent => (
                        <SelectItem key={parent.id} value={parent.id}>
                          {parent.full_name} ({parent.children.length} figli)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedParent && (
                  <div className="space-y-6 mt-4 p-4 border rounded-lg bg-background">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{selectedParent.full_name}</h3>
                        {selectedParent.email && (
                          <p className="text-sm text-muted-foreground">{selectedParent.email}</p>
                        )}
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
      </main>
    </div>
  );
}