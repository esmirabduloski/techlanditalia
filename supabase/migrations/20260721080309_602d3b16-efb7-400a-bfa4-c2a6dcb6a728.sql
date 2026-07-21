BEGIN;
UPDATE blog_posts SET content = REPLACE(content, '/corsi/python-base-ai', '/corsi/python-ai'), updated_at = now()
  WHERE published = true AND content LIKE '%/corsi/python-base-ai%';
UPDATE blog_posts SET content = REPLACE(content, '/corsi/python-base-base', '/corsi/python-base'), updated_at = now()
  WHERE published = true AND content LIKE '%/corsi/python-base-base%';
COMMIT;