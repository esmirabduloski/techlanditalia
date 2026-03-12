import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FileText, Save, Loader2, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Student {
  student_id: string;
  full_name: string;
}

interface LessonScheduleItem {
  lesson_number: number;
  lesson_title: string | null;
  lesson_date: string;
}

interface LessonReportFormProps {
  groupId: string;
  teacherId: string;
  students: Student[];
  lessonSchedule: LessonScheduleItem[];
}

interface ReportData {
  topics_covered: string;
  topics_not_covered: string;
  students_needing_support: string[];
  support_notes: string;
}

export function LessonReportForm({ groupId, teacherId, students, lessonSchedule }: LessonReportFormProps) {
  const { toast } = useToast();
  const [selectedLesson, setSelectedLesson] = useState<string>("");
  const [report, setReport] = useState<ReportData>({
    topics_covered: "",
    topics_not_covered: "",
    students_needing_support: [],
    support_notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [existingReportId, setExistingReportId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [savedLessons, setSavedLessons] = useState<Set<number>>(new Set());

  // Load which lessons already have reports
  useEffect(() => {
    const loadSavedLessons = async () => {
      const { data } = await supabase
        .from("lesson_reports")
        .select("lesson_number")
        .eq("group_id", groupId)
        .eq("teacher_id", teacherId);

      if (data) {
        setSavedLessons(new Set(data.map((r: any) => r.lesson_number)));
      }
    };
    loadSavedLessons();
  }, [groupId, teacherId]);

  // Load existing report when lesson changes
  useEffect(() => {
    if (!selectedLesson) {
      setExistingReportId(null);
      setReport({ topics_covered: "", topics_not_covered: "", students_needing_support: [], support_notes: "" });
      return;
    }

    const loadReport = async () => {
      const { data } = await supabase
        .from("lesson_reports")
        .select("*")
        .eq("group_id", groupId)
        .eq("lesson_number", parseInt(selectedLesson))
        .maybeSingle();

      if (data) {
        setExistingReportId(data.id);
        setReport({
          topics_covered: data.topics_covered || "",
          topics_not_covered: data.topics_not_covered || "",
          students_needing_support: (data.students_needing_support as string[]) || [],
          support_notes: data.support_notes || "",
        });
      } else {
        setExistingReportId(null);
        setReport({ topics_covered: "", topics_not_covered: "", students_needing_support: [], support_notes: "" });
      }
    };
    loadReport();
  }, [selectedLesson, groupId]);

  const handleStudentToggle = (studentId: string) => {
    setReport(prev => ({
      ...prev,
      students_needing_support: prev.students_needing_support.includes(studentId)
        ? prev.students_needing_support.filter(id => id !== studentId)
        : [...prev.students_needing_support, studentId],
    }));
  };

  const handleSave = async () => {
    if (!selectedLesson) return;
    setIsSaving(true);

    const payload = {
      group_id: groupId,
      lesson_number: parseInt(selectedLesson),
      teacher_id: teacherId,
      topics_covered: report.topics_covered,
      topics_not_covered: report.topics_not_covered,
      students_needing_support: report.students_needing_support,
      support_notes: report.support_notes,
      updated_at: new Date().toISOString(),
    };

    try {
      if (existingReportId) {
        const { error } = await supabase
          .from("lesson_reports")
          .update(payload)
          .eq("id", existingReportId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("lesson_reports")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        setExistingReportId(data.id);
      }

      setSavedLessons(prev => new Set([...prev, parseInt(selectedLesson)]));
      toast({ title: "Report salvato", description: "Il report della lezione è stato salvato con successo." });
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Sort lessons: most recent first for the dropdown
  const sortedLessons = [...lessonSchedule].sort((a, b) => b.lesson_number - a.lesson_number);

  return (
    <Card className="mb-6">
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Report Lezione
          </span>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </CardTitle>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-5">
          {/* Lesson selector */}
          <div>
            <Label className="mb-2 block">Seleziona Lezione</Label>
            <Select value={selectedLesson} onValueChange={setSelectedLesson}>
              <SelectTrigger>
                <SelectValue placeholder="Scegli una lezione..." />
              </SelectTrigger>
              <SelectContent>
                {sortedLessons.map(lesson => (
                  <SelectItem key={lesson.lesson_number} value={String(lesson.lesson_number)}>
                    <span className="flex items-center gap-2">
                      {lesson.lesson_title || `Lezione ${lesson.lesson_number}`}
                      <span className="text-muted-foreground text-xs">
                        ({new Date(lesson.lesson_date).toLocaleDateString("it-IT")})
                      </span>
                      {savedLessons.has(lesson.lesson_number) && (
                        <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedLesson && (
            <>
              {/* Topics covered */}
              <div>
                <Label className="mb-2 block">✅ Argomenti trattati</Label>
                <Textarea
                  value={report.topics_covered}
                  onChange={e => setReport(prev => ({ ...prev, topics_covered: e.target.value }))}
                  placeholder="Es: Variabili in Python, cicli for, esercizi su liste..."
                  rows={3}
                />
              </div>

              {/* Topics NOT covered */}
              <div>
                <Label className="mb-2 block">⏭️ Argomenti non trattati</Label>
                <Textarea
                  value={report.topics_not_covered}
                  onChange={e => setReport(prev => ({ ...prev, topics_not_covered: e.target.value }))}
                  placeholder="Es: Funzioni - rimandato alla prossima lezione..."
                  rows={3}
                />
              </div>

              {/* Students needing support */}
              <div>
                <Label className="mb-2 block">🆘 Studenti che necessitano supporto</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {students.map(student => (
                    <div
                      key={student.student_id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                        report.students_needing_support.includes(student.student_id)
                          ? "bg-orange-50 border-orange-300 dark:bg-orange-950/30 dark:border-orange-700"
                          : "hover:bg-muted/50"
                      )}
                      onClick={() => handleStudentToggle(student.student_id)}
                    >
                      <Checkbox
                        checked={report.students_needing_support.includes(student.student_id)}
                        onCheckedChange={() => handleStudentToggle(student.student_id)}
                      />
                      <span className="text-sm font-medium">{student.full_name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Support notes */}
              {report.students_needing_support.length > 0 && (
                <div>
                  <Label className="mb-2 block">📝 Note sul supporto necessario</Label>
                  <Textarea
                    value={report.support_notes}
                    onChange={e => setReport(prev => ({ ...prev, support_notes: e.target.value }))}
                    placeholder="Descrivi brevemente le difficoltà riscontrate..."
                    rows={2}
                  />
                </div>
              )}

              {/* Save button */}
              <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {existingReportId ? "Aggiorna Report" : "Salva Report"}
              </Button>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
