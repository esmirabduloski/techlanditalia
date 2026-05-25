import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Loader2, Calendar, ChevronLeft, ChevronRight, Save, RotateCcw, Link2, Plus, Check
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface LessonSchedule {
  id: string;
  lesson_number: number;
  lesson_date: string;
  lesson_title: string | null;
  lesson_time: string | null;
  recording_url: string | null;
}

interface LessonCalendarManagerProps {
  groupId: string;
  groupTitle: string;
  startDate: string | null;
  maxLessons: number;
  lessonDays: number[];
  defaultLessonTime: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RecordingUrlButton({
  lesson,
  isSaving,
  onSave,
}: {
  lesson: LessonSchedule;
  isSaving: boolean;
  onSave: (url: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(lesson.recording_url || "");
  const hasLink = !!lesson.recording_url;

  useEffect(() => {
    setValue(lesson.recording_url || "");
  }, [lesson.recording_url]);

  const handleSave = async () => {
    const saved = await onSave(value);
    if (saved) setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={`absolute right-2 top-2 z-10 h-9 w-9 rounded-md shadow-tech-sm ${
            hasLink
              ? "border-secondary bg-secondary text-secondary-foreground hover:bg-secondary/90"
              : "border-secondary/50 bg-background text-secondary hover:bg-secondary/10"
          }`}
          aria-label={hasLink ? "Modifica link registrazione" : "Aggiungi link registrazione"}
          title={hasLink ? "Modifica link registrazione" : "Aggiungi link registrazione"}
        >
          {hasLink ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <div className="space-y-1">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Link2 className="w-4 h-4 text-secondary" />
            Link registrazione
          </p>
          <p className="text-xs text-muted-foreground">
            {lesson.lesson_title || `L${lesson.lesson_number}`}
          </p>
        </div>
        <Input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://..."
          autoFocus
        />
        <div className="flex justify-end gap-2">
          {hasLink && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setValue("")}>
              Svuota
            </Button>
          )}
          <Button type="button" size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            Salva
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function LessonCalendarManager({
  groupId,
  groupTitle,
  startDate,
  maxLessons,
  lessonDays,
  defaultLessonTime,
  open,
  onOpenChange
}: LessonCalendarManagerProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [schedule, setSchedule] = useState<LessonSchedule[]>([]);
  const [editedDates, setEditedDates] = useState<Record<number, string>>({});
  const [editedTimes, setEditedTimes] = useState<Record<number, string>>({});
  const [savingRecordingLessonId, setSavingRecordingLessonId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const lessonsPerPage = 16;

  useEffect(() => {
    if (open && groupId) {
      fetchSchedule();
    }
  }, [open, groupId]);

  const fetchSchedule = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('group_lesson_schedule')
        .select('*')
        .eq('group_id', groupId)
        .order('lesson_number');

      if (data && data.length > 0) {
        setSchedule(data);
      } else if (startDate) {
        // Generate schedule if doesn't exist
        await generateSchedule();
      }
    } catch (error) {
      console.error("Error fetching schedule:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSchedule = async () => {
    if (!startDate) return;

    const scheduleItems = [];
    let currentDate = new Date(startDate);
    let lessonCount = 0;

    while (lessonCount < maxLessons) {
      const dayOfWeek = currentDate.getDay();
      
      if (lessonDays.includes(dayOfWeek)) {
        lessonCount++;
        scheduleItems.push({
          group_id: groupId,
          lesson_number: lessonCount,
          lesson_date: format(currentDate, 'yyyy-MM-dd'),
          lesson_title: `M${Math.ceil(lessonCount / 4)}L${((lessonCount - 1) % 4) + 1}`,
          lesson_time: defaultLessonTime || null
        });
      }
      
      currentDate = addDays(currentDate, 1);
      if (lessonCount >= maxLessons) break;
    }

    if (scheduleItems.length > 0) {
      const { data, error } = await supabase
        .from('group_lesson_schedule')
        .insert(scheduleItems)
        .select();

      if (!error && data) {
        setSchedule(data);
      }
    }
  };

  const handleDateChange = (lessonNumber: number, newDate: string) => {
    setEditedDates(prev => ({ ...prev, [lessonNumber]: newDate }));
  };

  const handleTimeChange = (lessonNumber: number, newTime: string) => {
    setEditedTimes(prev => ({ ...prev, [lessonNumber]: newTime }));
  };

  const handleBulkTimeChange = (fromLessonNumber: number, newTime: string) => {
    const newEdits: Record<number, string> = {};
    schedule.forEach(lesson => {
      if (lesson.lesson_number >= fromLessonNumber) {
        newEdits[lesson.lesson_number] = newTime;
      }
    });
    setEditedTimes(prev => ({ ...prev, ...newEdits }));
  };

  const handleRecordingSave = async (lesson: LessonSchedule, newUrl: string) => {
    const trimmed = newUrl.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      toast({ title: 'URL non valido', description: 'Inserisci un link che inizi con https://', variant: 'destructive' });
      return false;
    }

    setSavingRecordingLessonId(lesson.id);
    const { error } = await supabase
      .from('group_lesson_schedule')
      .update({ recording_url: trimmed || null })
      .eq('id', lesson.id);
    setSavingRecordingLessonId(null);

    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
      return false;
    }

    setSchedule(prev => prev.map(item => (
      item.id === lesson.id ? { ...item, recording_url: trimmed || null } : item
    )));
    toast({ title: trimmed ? 'Link registrazione salvato' : 'Link registrazione rimosso' });
    return true;
  };

  const handleSave = async () => {
    const hasDateChanges = Object.keys(editedDates).length > 0;
    const hasTimeChanges = Object.keys(editedTimes).length > 0;
    if (!hasDateChanges && !hasTimeChanges) return;
    setIsSaving(true);
    try {
      // Check for conflicts and shift dates if needed
      const updatedSchedule = [...schedule];
      const sortedEdits = Object.entries(editedDates)
        .map(([num, date]) => ({ lessonNumber: parseInt(num), newDate: date }))
        .sort((a, b) => a.lessonNumber - b.lessonNumber);

      for (const edit of sortedEdits) {
        const currentLesson = updatedSchedule.find(l => l.lesson_number === edit.lessonNumber);
        if (!currentLesson) continue;

        const newDateObj = parseISO(edit.newDate);
        
        // Check if this date conflicts with any other lesson
        const conflictingLesson = updatedSchedule.find(
          l => l.lesson_number !== edit.lessonNumber && 
               l.lesson_date === edit.newDate
        );

        if (conflictingLesson) {
          // Shift all lessons from the conflicting one onwards by 7 days
          for (let i = conflictingLesson.lesson_number - 1; i < updatedSchedule.length; i++) {
            if (i >= edit.lessonNumber - 1) {
              const lesson = updatedSchedule[i];
              if (lesson.lesson_number >= conflictingLesson.lesson_number) {
                const currentLessonDate = parseISO(lesson.lesson_date);
                lesson.lesson_date = format(addDays(currentLessonDate, 7), 'yyyy-MM-dd');
              }
            }
          }
        }

        // Update the edited lesson
        currentLesson.lesson_date = edit.newDate;
      }

      // Apply time changes
      for (const lesson of updatedSchedule) {
        const editedTime = editedTimes[lesson.lesson_number];
        if (editedTime !== undefined) {
          lesson.lesson_time = editedTime || null;
        }
      }

      // Save all changes to database
      for (const lesson of updatedSchedule) {
        await supabase
          .from('group_lesson_schedule')
          .update({
            lesson_date: lesson.lesson_date,
            lesson_time: lesson.lesson_time,
            recording_url: lesson.recording_url,
          })
          .eq('id', lesson.id);
      }

      setSchedule(updatedSchedule);
      setEditedDates({});
      setEditedTimes({});
      toast({ title: 'Calendario salvato', description: 'Le date e gli orari sono stati aggiornati' });
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!startDate) {
      toast({ title: 'Errore', description: 'Imposta prima una data di inizio', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      // Delete existing schedule
      await supabase
        .from('group_lesson_schedule')
        .delete()
        .eq('group_id', groupId);

      // Generate new schedule
      await generateSchedule();
      setEditedDates({});
      setEditedTimes({});
      toast({ title: 'Calendario rigenerato' });
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const paginatedSchedule = schedule.slice(
    page * lessonsPerPage,
    (page + 1) * lessonsPerPage
  );
  const totalPages = Math.ceil(schedule.length / lessonsPerPage);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Calendario Lezioni - {groupTitle}
          </DialogTitle>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Plus className="w-4 h-4 text-secondary" />
            Premi il pulsante + su una lezione per aggiungere o modificare il link della registrazione.
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : schedule.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Nessun calendario generato</p>
            {startDate ? (
              <Button onClick={handleRegenerate}>
                Genera Calendario
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Imposta una data di inizio gruppo</p>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {paginatedSchedule.map(lesson => {
                const editedDate = editedDates[lesson.lesson_number];
                const editedTime = editedTimes[lesson.lesson_number];
                const displayDate = editedDate || lesson.lesson_date;
                const displayTime = editedTime !== undefined ? editedTime : (lesson.lesson_time?.substring(0, 5) || '');
                const isEdited = !!editedDate || editedTime !== undefined;

                return (
                  <Card key={lesson.id} className={`relative ${isEdited ? 'ring-2 ring-primary' : ''}`}>
                    <RecordingUrlButton
                      lesson={lesson}
                      isSaving={savingRecordingLessonId === lesson.id}
                      onSave={(url) => handleRecordingSave(lesson, url)}
                    />
                    <CardContent className="p-3 pt-12">
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {lesson.lesson_title || `L${lesson.lesson_number}`}
                        </Badge>
                        {lesson.recording_url && (
                          <Badge variant="outline" className="text-[10px] border-secondary/40 text-secondary">
                            Link salvato
                          </Badge>
                        )}
                        {isEdited && (
                          <Badge variant="default" className="text-[10px]">
                            Modificata
                          </Badge>
                        )}
                      </div>
                      <Input
                        type="date"
                        value={displayDate}
                        onChange={(e) => handleDateChange(lesson.lesson_number, e.target.value)}
                        className="text-sm"
                      />
                      <div className="flex items-center gap-1 mt-1">
                        <Input
                          type="time"
                          value={displayTime}
                          onChange={(e) => handleTimeChange(lesson.lesson_number, e.target.value)}
                          className="text-sm flex-1"
                          placeholder="--:--"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                          title="Applica orario a tutte le lezioni successive"
                          onClick={() => {
                            if (displayTime) {
                              handleBulkTimeChange(lesson.lesson_number, displayTime);
                            }
                          }}
                          disabled={!displayTime}
                        >
                          <ChevronRight className="w-3 h-3" />
                          <ChevronRight className="w-3 h-3 -ml-2" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 text-center">
                        {format(parseISO(displayDate), "EEEE d MMMM", { locale: it })}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Pagina {page + 1} di {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleRegenerate} disabled={isLoading || !startDate}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Rigenera
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || (Object.keys(editedDates).length === 0 && Object.keys(editedTimes).length === 0)}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salva Modifiche
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
