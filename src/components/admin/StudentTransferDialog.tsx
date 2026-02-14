import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, Search, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface StudentTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceGroupId: string;
  sourceGroupTitle: string;
  onComplete: () => void;
}

interface GroupOption {
  id: string;
  title: string;
  course_title: string;
  course_emoji: string;
  student_count: number;
}

interface StudentOption {
  id: string;
  student_id: string;
  full_name: string;
  username: string | null;
}

export function StudentTransferDialog({
  open, onOpenChange, sourceGroupId, sourceGroupTitle, onComplete
}: StudentTransferDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [targetGroupId, setTargetGroupId] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      fetchData();
      setSelectedStudents([]);
      setTargetGroupId("");
      setSearch("");
    }
  }, [open, sourceGroupId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch students in source group
      const { data: studentsData } = await supabase
        .from('group_students')
        .select('id, student_id, profiles!inner(full_name, username)')
        .eq('group_id', sourceGroupId);

      setStudents((studentsData || []).map((s: any) => ({
        id: s.id,
        student_id: s.student_id,
        full_name: s.profiles?.full_name || '',
        username: s.profiles?.username || null,
      })));

      // Fetch other groups
      const { data: groupsData } = await supabase
        .from('student_groups')
        .select('id, title, course_id, courses!inner(title, emoji)')
        .neq('id', sourceGroupId)
        .eq('status', 'active');

      if (groupsData) {
        const enriched = await Promise.all(groupsData.map(async (g: any) => {
          const { count } = await supabase
            .from('group_students')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', g.id);
          return {
            id: g.id,
            title: g.title,
            course_title: g.courses?.title || '',
            course_emoji: g.courses?.emoji || '',
            student_count: count || 0,
          };
        }));
        setGroups(enriched);
      }
    } catch (error) {
      console.error("Error fetching transfer data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (selectedStudents.length === 0 || !targetGroupId) return;
    setIsSaving(true);
    try {
      // Remove from source group
      await supabase
        .from('group_students')
        .delete()
        .eq('group_id', sourceGroupId)
        .in('student_id', selectedStudents);

      // Check which students already exist in target to avoid duplicates
      const { data: existing } = await supabase
        .from('group_students')
        .select('student_id')
        .eq('group_id', targetGroupId)
        .in('student_id', selectedStudents);

      const existingIds = new Set((existing || []).map(e => e.student_id));
      const toInsert = selectedStudents
        .filter(id => !existingIds.has(id))
        .map(student_id => ({ group_id: targetGroupId, student_id }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from('group_students').insert(toInsert);
        if (error) throw error;
      }

      const targetGroup = groups.find(g => g.id === targetGroupId);
      toast({
        title: 'Trasferimento completato',
        description: `${selectedStudents.length} studente/i trasferito/i a "${targetGroup?.title}"`,
      });
      onOpenChange(false);
      onComplete();
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const filteredStudents = students.filter(s => {
    const q = search.toLowerCase();
    return s.full_name.toLowerCase().includes(q) || (s.username && s.username.toLowerCase().includes(q));
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5" />
            Trasferisci Studenti da "{sourceGroupTitle}"
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Select students */}
            <div className="space-y-2">
              <Label>Seleziona studenti da trasferire ({selectedStudents.length}/{students.length})</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca..." className="pl-9" />
              </div>
              <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                {filteredStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nessuno studente</p>
                ) : filteredStudents.map(s => (
                  <div key={s.student_id} className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer" onClick={() => toggleStudent(s.student_id)}>
                    <Checkbox checked={selectedStudents.includes(s.student_id)} />
                    <span className="text-sm">{s.full_name}</span>
                    {s.username && <span className="text-xs text-muted-foreground">@{s.username}</span>}
                  </div>
                ))}
              </div>
              {students.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedStudents(
                  selectedStudents.length === students.length ? [] : students.map(s => s.student_id)
                )}>
                  {selectedStudents.length === students.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                </Button>
              )}
            </div>

            {/* Select target group */}
            <div className="space-y-2">
              <Label>Gruppo di destinazione</Label>
              <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona gruppo destinazione..." />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.course_emoji} {g.title} ({g.student_count} studenti)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {groups.length === 0 && (
                <p className="text-sm text-muted-foreground">Nessun altro gruppo attivo disponibile</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleTransfer} disabled={isSaving || selectedStudents.length === 0 || !targetGroupId}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
            Trasferisci {selectedStudents.length > 0 ? `(${selectedStudents.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
