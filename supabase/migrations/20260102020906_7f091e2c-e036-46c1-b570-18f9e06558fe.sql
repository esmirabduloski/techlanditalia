
-- Teacher profiles for additional info
CREATE TABLE public.teacher_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT,
  availability JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Teacher-Course assignments (which courses a teacher can teach)
CREATE TABLE public.teacher_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(teacher_id, course_id)
);

-- Student groups
CREATE TABLE public.student_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date DATE,
  last_lesson_title TEXT,
  max_lessons INTEGER DEFAULT 32,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Group members (students in groups)
CREATE TABLE public.group_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.student_groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(group_id, student_id)
);

-- Group attendance (per lesson slot)
CREATE TABLE public.group_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.student_groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'absent',
  marked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  marked_by UUID REFERENCES auth.users(id),
  notes TEXT,
  UNIQUE(group_id, student_id, lesson_number)
);

-- Enable RLS
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teacher_profiles
CREATE POLICY "Admins can manage teacher profiles" ON public.teacher_profiles FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can view own profile" ON public.teacher_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Teachers can update own profile" ON public.teacher_profiles FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for teacher_courses
CREATE POLICY "Admins can manage teacher courses" ON public.teacher_courses FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can view own courses" ON public.teacher_courses FOR SELECT USING (auth.uid() = teacher_id);

-- RLS Policies for student_groups
CREATE POLICY "Admins can manage groups" ON public.student_groups FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can view assigned groups" ON public.student_groups FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update assigned groups" ON public.student_groups FOR UPDATE USING (auth.uid() = teacher_id);

-- RLS Policies for group_students
CREATE POLICY "Admins can manage group students" ON public.group_students FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can view group students" ON public.group_students FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.student_groups sg WHERE sg.id = group_id AND sg.teacher_id = auth.uid())
);

-- RLS Policies for group_attendance
CREATE POLICY "Admins can manage group attendance" ON public.group_attendance FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can manage attendance for assigned groups" ON public.group_attendance FOR ALL USING (
  EXISTS (SELECT 1 FROM public.student_groups sg WHERE sg.id = group_id AND sg.teacher_id = auth.uid())
);

-- Trigger for updated_at
CREATE TRIGGER update_teacher_profiles_updated_at BEFORE UPDATE ON public.teacher_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_student_groups_updated_at BEFORE UPDATE ON public.student_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add manual_url to lessons table for teacher manual links
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS manual_url TEXT;
