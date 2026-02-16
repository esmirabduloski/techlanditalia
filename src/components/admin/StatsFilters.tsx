import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Filter, X } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export interface StatsFilters {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  courseId: string | undefined;
  teacherId: string | undefined;
}

interface Course {
  id: string;
  title: string;
  emoji: string;
}

interface Teacher {
  id: string;
  full_name: string;
}

interface StatsFiltersProps {
  filters: StatsFilters;
  onFiltersChange: (filters: StatsFilters) => void;
}

export function StatsFiltersBar({ filters, onFiltersChange }: StatsFiltersProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    const [coursesRes, teacherRolesRes] = await Promise.all([
      supabase.from('courses').select('id, title, emoji').order('title'),
      supabase.from('user_roles').select('user_id').eq('role', 'teacher'),
    ]);

    if (coursesRes.data) setCourses(coursesRes.data);

    if (teacherRolesRes.data && teacherRolesRes.data.length > 0) {
      const teacherIds = teacherRolesRes.data.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', teacherIds)
        .order('full_name');
      if (profiles) setTeachers(profiles);
    }
  };

  const hasActiveFilters = filters.dateFrom || filters.dateTo || filters.courseId || filters.teacherId;

  const clearFilters = () => {
    onFiltersChange({ dateFrom: undefined, dateTo: undefined, courseId: undefined, teacherId: undefined });
  };

  const setPreset = (months: number) => {
    const now = new Date();
    onFiltersChange({
      ...filters,
      dateFrom: startOfMonth(subMonths(now, months - 1)),
      dateTo: endOfMonth(now),
    });
  };

  return (
    <div className="bg-background border rounded-lg p-4 mb-6 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="w-4 h-4" />
          Filtri
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
            <X className="w-3 h-3 mr-1" />
            Rimuovi filtri
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {/* Period presets */}
        <div className="flex gap-1">
          {[
            { label: '3 mesi', value: 3 },
            { label: '6 mesi', value: 6 },
            { label: '12 mesi', value: 12 },
          ].map(p => (
            <Button key={p.value} variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPreset(p.value)}>
              {p.label}
            </Button>
          ))}
        </div>

        {/* Date From */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn('h-8 text-xs justify-start', !filters.dateFrom && 'text-muted-foreground')}>
              <CalendarIcon className="w-3 h-3 mr-1" />
              {filters.dateFrom ? format(filters.dateFrom, 'dd MMM yyyy', { locale: it }) : 'Da'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateFrom}
              onSelect={(d) => onFiltersChange({ ...filters, dateFrom: d })}
              className="p-3 pointer-events-auto"
              locale={it}
            />
          </PopoverContent>
        </Popover>

        {/* Date To */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn('h-8 text-xs justify-start', !filters.dateTo && 'text-muted-foreground')}>
              <CalendarIcon className="w-3 h-3 mr-1" />
              {filters.dateTo ? format(filters.dateTo, 'dd MMM yyyy', { locale: it }) : 'A'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateTo}
              onSelect={(d) => onFiltersChange({ ...filters, dateTo: d })}
              className="p-3 pointer-events-auto"
              locale={it}
            />
          </PopoverContent>
        </Popover>

        {/* Course filter */}
        <Select value={filters.courseId || 'all'} onValueChange={(v) => onFiltersChange({ ...filters, courseId: v === 'all' ? undefined : v })}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="Tutti i corsi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i corsi</SelectItem>
            {courses.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.emoji} {c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Teacher filter */}
        <Select value={filters.teacherId || 'all'} onValueChange={(v) => onFiltersChange({ ...filters, teacherId: v === 'all' ? undefined : v })}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="Tutti gli insegnanti" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli insegnanti</SelectItem>
            {teachers.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
