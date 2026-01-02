import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, User } from "lucide-react";
import { AdminNav } from "@/components/admin/AdminNav";

interface AvailabilitySlot {
  day: string;
  startTime: string;
  endTime: string;
}

interface Teacher {
  id: string;
  full_name: string;
  email: string;
  availability: AvailabilitySlot[];
  color: string;
}

const DAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 - 21:00

const TEACHER_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-red-500",
  "bg-indigo-500",
  "bg-yellow-500",
  "bg-cyan-500",
];

export default function AdminTeacherCalendar() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("all");

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    try {
      // Get all users with teacher role
      const { data: teacherRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'teacher');

      if (!teacherRoles || teacherRoles.length === 0) {
        setIsLoading(false);
        return;
      }

      const teacherIds = teacherRoles.map(r => r.user_id);

      // Get profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', teacherIds);

      // Get teacher profiles with availability
      const { data: teacherProfiles } = await supabase
        .from('teacher_profiles')
        .select('user_id, availability')
        .in('user_id', teacherIds);

      const teachersWithAvailability: Teacher[] = (profiles || []).map((profile, index) => {
        const teacherProfile = teacherProfiles?.find(tp => tp.user_id === profile.id);
        const availability = Array.isArray(teacherProfile?.availability)
          ? (teacherProfile.availability as unknown as AvailabilitySlot[])
          : [];
        
        return {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email || "",
          availability,
          color: TEACHER_COLORS[index % TEACHER_COLORS.length]
        };
      });

      setTeachers(teachersWithAvailability);
    } catch (error) {
      console.error("Error fetching teachers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSlotForCell = (day: string, hour: number): { teacher: Teacher; slot: AvailabilitySlot }[] => {
    const filteredTeachers = selectedTeacher === "all" 
      ? teachers 
      : teachers.filter(t => t.id === selectedTeacher);

    const slots: { teacher: Teacher; slot: AvailabilitySlot }[] = [];

    filteredTeachers.forEach(teacher => {
      teacher.availability.forEach(slot => {
        if (slot.day === day) {
          const startHour = parseInt(slot.startTime.split(":")[0]);
          const endHour = parseInt(slot.endTime.split(":")[0]);
          const endMinute = parseInt(slot.endTime.split(":")[1]);
          
          // Check if this hour falls within the slot
          if (hour >= startHour && (hour < endHour || (hour === endHour && endMinute > 0))) {
            slots.push({ teacher, slot });
          }
        }
      });
    });

    return slots;
  };

  const getSlotHeight = (slot: AvailabilitySlot, hour: number): { isStart: boolean; isEnd: boolean; heightPercent: number } => {
    const startHour = parseInt(slot.startTime.split(":")[0]);
    const startMinute = parseInt(slot.startTime.split(":")[1]);
    const endHour = parseInt(slot.endTime.split(":")[0]);
    const endMinute = parseInt(slot.endTime.split(":")[1]);

    const isStart = hour === startHour;
    const isEnd = hour === endHour - 1 || (hour === endHour && endMinute > 0);

    return { isStart, isEnd, heightPercent: 100 };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <AdminNav />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Calendar className="w-8 h-8 text-primary" />
              Disponibilità Insegnanti
            </h1>
            <p className="text-muted-foreground mt-1">
              Visualizza la disponibilità oraria di tutti gli insegnanti
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtra per insegnante" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli insegnanti</SelectItem>
                {teachers.map(teacher => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${teacher.color}`} />
                      {teacher.full_name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Legend */}
        {selectedTeacher === "all" && teachers.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                Legenda Insegnanti
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="flex flex-wrap gap-3">
                {teachers.map(teacher => (
                  <Badge 
                    key={teacher.id} 
                    variant="secondary" 
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                    onClick={() => setSelectedTeacher(teacher.id)}
                  >
                    <div className={`w-3 h-3 rounded-full ${teacher.color}`} />
                    {teacher.full_name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Calendar Grid */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header */}
              <div className="grid grid-cols-8 border-b">
                <div className="p-3 font-medium text-center text-sm bg-muted/50">Ora</div>
                {DAYS.map(day => (
                  <div key={day} className="p-3 font-medium text-center text-sm bg-muted/50 border-l">
                    {day}
                  </div>
                ))}
              </div>

              {/* Time slots */}
              {HOURS.map(hour => (
                <div key={hour} className="grid grid-cols-8 border-b last:border-b-0">
                  <div className="p-2 text-center text-sm text-muted-foreground bg-muted/20 flex items-center justify-center">
                    {hour.toString().padStart(2, "0")}:00
                  </div>
                  {DAYS.map(day => {
                    const slots = getSlotForCell(day, hour);
                    return (
                      <div 
                        key={`${day}-${hour}`} 
                        className="border-l min-h-[50px] relative p-0.5"
                      >
                        {slots.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 h-full">
                            {slots.map(({ teacher, slot }, idx) => (
                              <div
                                key={`${teacher.id}-${idx}`}
                                className={`${teacher.color} text-white text-xs px-1 py-0.5 rounded flex-1 min-w-0 truncate flex items-center justify-center`}
                                title={`${teacher.full_name}: ${slot.startTime} - ${slot.endTime}`}
                              >
                                <span className="truncate text-[10px]">
                                  {selectedTeacher === "all" ? teacher.full_name.split(" ")[0] : `${slot.startTime}-${slot.endTime}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {teachers.length === 0 && (
          <Card className="mt-6">
            <CardContent className="py-12 text-center">
              <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nessun insegnante trovato</p>
            </CardContent>
          </Card>
        )}

        {teachers.length > 0 && teachers.every(t => t.availability.length === 0) && (
          <Card className="mt-6">
            <CardContent className="py-12 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nessuna disponibilità configurata. Configura gli orari dalla pagina Utenti.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
