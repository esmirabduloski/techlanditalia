BEGIN;

INSERT INTO content_snapshots (entity_type, entity_id, entity_label, snapshot_label, snapshot_data)
SELECT 'blog_post', id, slug, 'pre-fase1-audit',
  jsonb_build_object('title',title,'excerpt',excerpt,'content',content,'read_time',read_time)
FROM blog_posts WHERE slug IN ('la-programmazione','coding-matematica-bambini','primo-sito-web-bambini-guida','minecraft-coding-educativo','abc-informatica-fondamenta','minecraft-education-programmare','techland-10-lavori-futuro-coding','techland-python-linguaggio-richiesto-2026','python-base-linguaggio-futuro','techland-da-scratch-a-sviluppatore-percorso','techland-gaming-carriera-coding','techland-scratch-vs-roblox-confronto','techland-minecraft-education-differenze','techland-coding-creativita-arte','intelligenza-artificiale-spiegata-bambini','creare-videogiochi-imparare-coding','sicurezza-digitale-giovani-programmatori','domande-frequenti-genitori-coding','coding-inclusione-accessibilita','coding-soft-skills-lavoro-futuro','progetti-coding-estivi-bambini','10-benefici-coding-sviluppo-cognitivo-bambini','coding-scuola-italiana-situazione','coding-unplugged-programmare-senza-computer','techland-coding-adhd-concentrazione','scegliere-corso-programmazione-giusto','storie-successo-bambini-coding','techland-tempo-schermo-bambini-guida','abc-creativita-digitale-primo-passo','scratch-creativita-codice','coding-nuova-alfabetizzazione-bambini','python-turtle-programmare-disegnando','scratch-jr-programmazione-bambini-piccoli','scratch-piattaforma-programmazione-bambini','scratch-jr-vs-scratch-confronto-differenze','techland-coding-migliora-voti-scuola','techland-coding-materia-obbligatoria-scuola','techland-eta-iniziare-programmare-guida-fasce','techland-figlio-troppo-piccolo-programmare');

UPDATE blog_posts SET content = REPLACE(content, '/corsi/scratch', '/corsi'), updated_at = now() WHERE published = true AND content LIKE '%/corsi/scratch%';
UPDATE blog_posts SET content = REPLACE(content, '/corsi/minecraft-education', '/corsi/roblox'), updated_at = now() WHERE published = true AND content LIKE '%/corsi/minecraft-education%';
UPDATE blog_posts SET content = REPLACE(content, '/corsi/abc-creativita-digitale', '/corsi'), updated_at = now() WHERE published = true AND content LIKE '%/corsi/abc-creativita-digitale%';
UPDATE blog_posts SET content = REPLACE(content, '/corsi/python', '/corsi/python-base'), updated_at = now() WHERE published = true AND content LIKE '%/corsi/python%';

UPDATE blog_posts SET content = regexp_replace(content, '^# ', '## '), updated_at = now() WHERE slug = 'la-programmazione' AND published = true;

UPDATE blog_posts SET title = 'TECHLAND racconta: da Scratch a sviluppatore', updated_at = now() WHERE slug = 'techland-da-scratch-a-sviluppatore-percorso' AND published = true;
UPDATE blog_posts SET title = 'TECHLAND rivela: come il gaming può diventare una carriera', updated_at = now() WHERE slug = 'techland-gaming-carriera-coding' AND published = true;
UPDATE blog_posts SET title = 'TECHLAND confronta: Scratch vs Roblox', updated_at = now() WHERE slug = 'techland-scratch-vs-roblox-confronto' AND published = true;
UPDATE blog_posts SET title = 'TECHLAND spiega: coding e creatività', updated_at = now() WHERE slug = 'techland-coding-creativita-arte' AND published = true;
UPDATE blog_posts SET title = 'Intelligenza Artificiale e Bambini', updated_at = now() WHERE slug = 'intelligenza-artificiale-spiegata-bambini' AND published = true;
UPDATE blog_posts SET title = 'Sicurezza Digitale per Bambini che Programmano', updated_at = now() WHERE slug = 'sicurezza-digitale-giovani-programmatori' AND published = true;
UPDATE blog_posts SET title = 'Le Soft Skills che il Coding Insegna ai Bambini', updated_at = now() WHERE slug = 'coding-soft-skills-lavoro-futuro' AND published = true;
UPDATE blog_posts SET title = 'TECHLAND analizza: coding e ADHD', updated_at = now() WHERE slug = 'techland-coding-adhd-concentrazione' AND published = true;
UPDATE blog_posts SET title = 'L''ABC della creatività digitale', updated_at = now() WHERE slug = 'abc-creativita-digitale-primo-passo' AND published = true;
UPDATE blog_posts SET title = 'Programmazione visiva con Scratch', updated_at = now() WHERE slug = 'scratch-creativita-codice' AND published = true;
UPDATE blog_posts SET title = 'TECHLAND rivela: come il coding migliora i voti a scuola', updated_at = now() WHERE slug = 'techland-coding-migliora-voti-scuola' AND published = true;
UPDATE blog_posts SET title = 'TECHLAND consiglia: a che età iniziare a programmare', updated_at = now() WHERE slug = 'techland-eta-iniziare-programmare-guida-fasce' AND published = true;

UPDATE blog_posts SET excerpt = 'Un''introduzione facile e motivante alla programmazione per ragazzi. Scopri come funziona il codice, perché è importante imparare e come iniziare il tuo.', updated_at = now() WHERE slug = 'la-programmazione' AND published = true;
UPDATE blog_posts SET excerpt = 'Il viaggio reale, tappa per tappa, dal primo gioco con Scratch al diventare uno sviluppatore vero. Una guida per i genitori che vogliono capire dove può.', updated_at = now() WHERE slug = 'techland-da-scratch-a-sviluppatore-percorso' AND published = true;
UPDATE blog_posts SET excerpt = 'Il gaming non è solo perdita di tempo. È un settore da 200 miliardi che assume sviluppatori, designer e creator. Ecco come trasformare la passione in lavoro.', updated_at = now() WHERE slug = 'techland-gaming-carriera-coding' AND published = true;

COMMIT;