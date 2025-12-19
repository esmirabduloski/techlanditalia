-- Profiles table for students and parents
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('parent', 'student')),
  parent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  avatar_id INTEGER NOT NULL DEFAULT 1 CHECK (avatar_id >= 1 AND avatar_id <= 10),
  total_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Courses table
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  emoji TEXT NOT NULL DEFAULT '💻',
  total_lessons INTEGER NOT NULL DEFAULT 1,
  level TEXT NOT NULL DEFAULT 'base',
  duration TEXT,
  age_range TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Lessons table
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  points_reward INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(course_id, lesson_number)
);

-- Homework table
CREATE TABLE public.homework (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  points_reward INTEGER NOT NULL DEFAULT 25,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enrollments table
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  UNIQUE(student_id, course_id)
);

-- Lesson progress table
CREATE TABLE public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  points_earned INTEGER NOT NULL DEFAULT 0,
  UNIQUE(student_id, lesson_id)
);

-- Homework submissions table
CREATE TABLE public.homework_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  homework_id UUID NOT NULL REFERENCES public.homework(id) ON DELETE CASCADE,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved')),
  notes TEXT,
  points_earned INTEGER NOT NULL DEFAULT 0,
  UNIQUE(student_id, homework_id)
);

-- Gamification levels table
CREATE TABLE public.gamification_levels (
  level INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  min_points INTEGER NOT NULL,
  badge_emoji TEXT NOT NULL
);

-- Insert default gamification levels
INSERT INTO public.gamification_levels (level, name, min_points, badge_emoji) VALUES
(1, 'Principiante', 0, '🌱'),
(2, 'Apprendista', 100, '🌿'),
(3, 'Esploratore', 300, '🧭'),
(4, 'Costruttore', 600, '🔧'),
(5, 'Inventore', 1000, '💡'),
(6, 'Creatore', 1500, '🎨'),
(7, 'Maestro', 2200, '🎓'),
(8, 'Esperto', 3000, '⭐'),
(9, 'Ninja Digitale', 4000, '🥷'),
(10, 'Leggenda Tech', 5500, '🏆');

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_levels ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Parents can view their children profiles" ON public.profiles
  FOR SELECT USING (auth.uid() = parent_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Courses policies (public read, admin manage)
CREATE POLICY "Anyone can view courses" ON public.courses
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage courses" ON public.courses
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Lessons policies (public read, admin manage)
CREATE POLICY "Anyone can view lessons" ON public.lessons
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage lessons" ON public.lessons
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Homework policies (public read, admin manage)
CREATE POLICY "Anyone can view homework" ON public.homework
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage homework" ON public.homework
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Enrollments policies
CREATE POLICY "Students can view their enrollments" ON public.enrollments
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Parents can view children enrollments" ON public.enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = enrollments.student_id 
      AND profiles.parent_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all enrollments" ON public.enrollments
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Lesson progress policies
CREATE POLICY "Students can view their progress" ON public.lesson_progress
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their progress" ON public.lesson_progress
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Parents can view children progress" ON public.lesson_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = lesson_progress.student_id 
      AND profiles.parent_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all progress" ON public.lesson_progress
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Homework submissions policies
CREATE POLICY "Students can view their submissions" ON public.homework_submissions
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their submissions" ON public.homework_submissions
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Parents can view children submissions" ON public.homework_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = homework_submissions.student_id 
      AND profiles.parent_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all submissions" ON public.homework_submissions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Gamification levels policies (public read)
CREATE POLICY "Anyone can view levels" ON public.gamification_levels
  FOR SELECT USING (true);

-- Trigger for updating profiles.updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data ->> 'full_name', 'Utente'),
    COALESCE(new.raw_user_meta_data ->> 'role', 'student')
  );
  RETURN new;
END;
$$;

-- Trigger for auto-creating profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update total points when progress is added
CREATE OR REPLACE FUNCTION public.update_student_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET total_points = (
    SELECT COALESCE(SUM(points_earned), 0) 
    FROM public.lesson_progress 
    WHERE student_id = NEW.student_id
  ) + (
    SELECT COALESCE(SUM(points_earned), 0) 
    FROM public.homework_submissions 
    WHERE student_id = NEW.student_id
  )
  WHERE id = NEW.student_id;
  RETURN NEW;
END;
$$;

-- Triggers for updating points
CREATE TRIGGER update_points_on_lesson_progress
  AFTER INSERT ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_student_points();

CREATE TRIGGER update_points_on_homework_submission
  AFTER INSERT OR UPDATE ON public.homework_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_student_points();