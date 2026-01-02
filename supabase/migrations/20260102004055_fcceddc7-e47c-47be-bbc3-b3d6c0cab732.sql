-- Enable realtime for user_achievements table
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_achievements;

-- Enable realtime for profiles table (for level up detection)
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;