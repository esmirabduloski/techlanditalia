import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Merge, Split, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface GroupMergeSplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentGroupId: string;
  currentGroupTitle: string;
  currentCourseId: string;
  onComplete: () => void;
}

interface GroupOption {
  id: string;
  title: string;
  course_emoji: string;
  student_count: number;
}

interface StudentItem {
  student_id: string;
  full_name: string;
}

export function GroupMergeSplitDialog({
  open, onOpenChange, currentGroupId, currentGroupTitle, currentCourseId, onComplete
}: GroupMergeSplitDialogProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<string>("merge");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Merge state
  const [mergeGroups, setMergeGroups] = useState<GroupOption[]>([]);
  const [mergeTargetId, setMergeTargetId] = useState("");

  // Split state
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [splitStudents, setSplitStudents] = useState<string[]>([]);
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      fetchData();
      setMergeTargetId("");
      setSplitStudents([]);
      setNewGroupTitle("");
      setSearch("");
    }
  }, [open, currentGroupId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch groups with same course for merge
      const { data: sameCoursGroups } = await supabase
        .from('student_groups')
        .select('id, title, courses!inner(emoji)')
        .eq('course_id', currentCourseId)
        .neq('id', currentGroupId)
        .eq('status', 'active');

      if (sameCoursGroups) {
        const enriched = await Promise.all(sameCoursGroups.map(async (g: any) => {
          const { count } = await supabase
            .from('group_students')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', g.id);
          return {
            id: g.id,
            title: g.title,
            course_emoji: g.courses?.emoji || '',
            student_count: count || 0,
          };
        }));
        setMergeGroups(enriched);
      }

      // Fetch students for split
      const { data: studentsData } = await supabase
        .from('group_students')
        .select('student_id, profiles!inner(full_name)')
        .eq('group_id', currentGroupId);

      setStudents((studentsData || []).map((s: any) => ({
        student_id: s.student_id,
        full_name: s.profiles?.full_name || '',
      })));
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMerge = async () => {
    if (!mergeTargetId) return;
    setIsSaving(true);
    try {
      // Get students from the other group
      const { data: otherStudents } = await supabase
        .from('group_students')
        .select('student_id')
        .eq('group_id', mergeTargetId);

      // Get current students to avoid duplicates
      const { data: currentStudents } = await supabase
        .from('group_students')
        .select('student_id')
        .eq('group_id', currentGroupId);

      const currentIds = new Set((currentStudents || []).map(s => s.student_id));
      const toAdd = (otherStudents || [])
        .filter(s => !currentIds.has(s.student_id))
        .map(s => ({ group_id: currentGroupId, student_id: s.student_id }));

      if (toAdd.length > 0) {
        await supabase.from('group_students').insert(toAdd);
      }

      // Archive the merged group
      await supabase
        .from('student_groups')
        .update({ status: 'archived', archived_at: new Date().toISOString() })
        .eq('id', mergeTargetId);

      const targetGroup = mergeGroups.find(g => g.id === mergeTargetId);
      toast({
        title: 'Gruppi uniti',
        description: `"${targetGroup?.title}" è stato unito in "${currentGroupTitle}" e archiviato`,
      });
      onOpenChange(false);
      onComplete();
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSplit = async () => {
    if (splitStudents.length === 0 || !newGroupTitle.trim()) return;
    setIsSaving(true);
    try {
      // Get current group details for the new group
      const { data: sourceGroup } = await supabase
        .from('student_groups')
        .select('course_id, teacher_id, start_date, max_lessons, lesson_days, lesson_time')
        .eq('id', currentGroupId)
        .single();

      if (!sourceGroup) throw new Error('Gruppo non trovato');

      // Create new group
      const { data: newGroup, error: createError } = await supabase
        .from('student_groups')
        .insert({
          title: newGroupTitle.trim(),
          course_id: sourceGroup.course_id,
          teacher_id: sourceGroup.teacher_id,
          start_date: sourceGroup.start_date,
          max_lessons: sourceGroup.max_lessons,
          lesson_days: sourceGroup.lesson_days,
          lesson_time: sourceGroup.lesson_time,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Move selected students to new group
      await supabase
        .from('group_students')
        .delete()
        .eq('group_id', currentGroupId)
        .in('student_id', splitStudents);

      await supabase
        .from('group_students')
        .insert(splitStudents.map(sid => ({ group_id: newGroup.id, student_id: sid })));

      toast({
        title: 'Gruppo diviso',
        description: `Nuovo gruppo "${newGroupTitle}" creato con ${splitStudents.length} studenti`,
      });
      onOpenChange(false);
      onComplete();
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSplitStudent = (id: string) => {
    setSplitStudents(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const filteredStudents = students.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Unisci o Dividi - "{currentGroupTitle}"</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="merge" className="flex items-center gap-1">
                <Merge className="w-4 h-4" /> Unisci
              </TabsTrigger>
              <TabsTrigger value="split" className="flex items-center gap-1">
                <Split className="w-4 h-4" /> Dividi
              </TabsTrigger>
            </TabsList>

            <TabsContent value="merge" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Seleziona un gruppo dello stesso corso da unire in "{currentGroupTitle}". 
                Gli studenti verranno spostati e il gruppo selezionato verrà archiviato.
              </p>
              {mergeGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nessun altro gruppo attivo per questo corso
                </p>
              ) : (
                <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona gruppo da unire..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mergeGroups.map(g => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.course_emoji} {g.title} ({g.student_count} studenti)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
                <Button onClick={handleMerge} disabled={isSaving || !mergeTargetId}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Merge className="w-4 h-4 mr-2" />}
                  Unisci Gruppi
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="split" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Seleziona gli studenti da spostare in un nuovo gruppo. Il nuovo gruppo erediterà le stesse impostazioni.
              </p>

              <div className="space-y-2">
                <Label>Nome del nuovo gruppo *</Label>
                <Input
                  value={newGroupTitle}
                  onChange={e => setNewGroupTitle(e.target.value)}
                  placeholder="Es: Gruppo Python B"
                />
              </div>

              <div className="space-y-2">
                <Label>Studenti da spostare ({splitStudents.length}/{students.length})</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca..." className="pl-9" />
                </div>
                <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                  {filteredStudents.map(s => (
                    <div key={s.student_id} className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer" onClick={() => toggleSplitStudent(s.student_id)}>
                      <Checkbox checked={splitStudents.includes(s.student_id)} />
                      <span className="text-sm">{s.full_name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
                <Button onClick={handleSplit} disabled={isSaving || splitStudents.length === 0 || !newGroupTitle.trim()}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Split className="w-4 h-4 mr-2" />}
                  Dividi Gruppo
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
