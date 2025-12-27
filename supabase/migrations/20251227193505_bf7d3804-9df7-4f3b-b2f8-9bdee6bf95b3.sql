-- Insert admin profile if it doesn't exist (using 'parent' as profile role since admin role is in user_roles table)
INSERT INTO public.profiles (id, full_name, role)
VALUES ('154ab26c-e557-4687-99f2-340b9374f71b', 'Admin', 'parent')
ON CONFLICT (id) DO NOTHING;