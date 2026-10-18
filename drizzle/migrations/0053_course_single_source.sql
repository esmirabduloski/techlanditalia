UPDATE public.courses AS c
SET age_range = v.age_range
FROM (VALUES
  ('design-creativo', '5-7 anni'),
  ('informatica-di-base', '5+ anni'),
  ('programmazione-visiva-con-scratch', '8-10 anni'),
  ('programmazione-visiva-con-minecraft', '8+ anni'),
  ('roblox', '8+ anni'),
  ('roblox-avanzato', '10+ anni'),
  ('web-development', '13+ anni'),
  ('python-base', '13+ anni'),
  ('python-ai', '13+ anni')
) AS v(slug, age_range)
WHERE c.slug = v.slug
  AND c.age_range IS DISTINCT FROM v.age_range;

UPDATE public.courses AS c
SET description = v.description
FROM (VALUES
  ('roblox', 'Crea giochi con Roblox Studio: progetta mondi e personaggi, imposta le tue regole e pubblica il tuo primo videogame online.'),
  ('roblox-avanzato', 'Un corso pensato per chi usa già Roblox Studio: affina le tue abilità e crea giochi più complessi, originali e coinvolgenti.'),
  ('web-development', 'Immergiti nel mondo dello sviluppo web: impara linguaggi e stili di markup, collega siti a database, crea design e costruisci il tuo sito web.'),
  ('python-base', 'Impara Python, il linguaggio scelto dagli sviluppatori di tutto il mondo, e crea giochi, app e siti web trasformando le tue idee in progetti reali.'),
  ('python-ai', 'Un percorso avanzato per creare bot, siti web e progetti con IA. Con Python Avanzato lavori su progetti reali e partecipi a un hackathon sul clima.')
) AS v(slug, description)
WHERE c.slug = v.slug
  AND c.description IS DISTINCT FROM v.description;

UPDATE public.courses
SET level = 'base'
WHERE slug IN ('roblox', 'web-development')
  AND level IS DISTINCT FROM 'base';

UPDATE public.courses
SET duration = '8 mesi'
WHERE slug = 'programmazione-visiva-con-minecraft'
  AND duration IS DISTINCT FROM '8 mesi';

UPDATE public.courses AS c
SET total_lessons = 32
WHERE c.slug = 'programmazione-visiva-con-minecraft'
  AND c.total_lessons IS DISTINCT FROM 32
  AND NOT EXISTS (
    SELECT 1 FROM public.lessons AS l
    WHERE l.course_id = c.id AND l.lesson_number > 32
  );

UPDATE public.courses
SET detail_content = detail_content - 'age' - 'level' - 'duration'
WHERE detail_content ?| ARRAY['age', 'level', 'duration'];