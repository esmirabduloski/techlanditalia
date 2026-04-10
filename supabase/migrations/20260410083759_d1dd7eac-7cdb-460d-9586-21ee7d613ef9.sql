UPDATE public.landing_pages
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{course_info}',
  '{
    "description": "Con Scratch ogni bambino dà vita a giochi e personaggi, imparando la logica della programmazione a blocchi in modo intuitivo e coinvolgente.",
    "longDescription": "Questo corso è per bambini della scuola primaria che vogliono approcciarsi alla sfera dell''Information Technology. Con l''aiuto della programmazione visiva in Scratch, gli studenti saranno in grado di sviluppare non solo il loro pensiero logico ma anche le loro abilità creative. Durante il corso, i bambini trasformeranno vari progetti e impareranno come creare giochi e cartoni in modo indipendente.",
    "age": "8-10 anni",
    "level": "Principiante",
    "duration": "32 lezioni",
    "tags": ["Scratch", "Creatività", "Sviluppo di giochi", "Animazione"],
    "topics": [
      "Crea i tuoi giochi in 2D",
      "Crea i tuoi personaggi",
      "Crea i tuoi progetti su Scratch",
      "Conoscenza dei concetti di base di algoritmi e programmazione",
      "Abilità di applicare variabili, loop e condizioni",
      "Abilità di creare la fisica dei giochi: scrolling, gravità, cambio di velocità"
    ],
    "modules": [
      {"title": "I primi progetti con Scratch", "result": "Il primissimo progetto Scratch alla Scuola di Magia Kodewarts."},
      {"title": "Animazioni e Suoni", "result": "Un''eccezionale app musicale animata."},
      {"title": "La magia di creare i giochi", "result": "Un gioco completo contenente meccaniche di gameplay base."},
      {"title": "Narrazione e sviluppo del gioco", "result": "Giochi basati su una storia con Scratch."},
      {"title": "Scratch avanzato", "result": "Progetti Scratch con fantastiche possibilità."},
      {"title": "Hackathon - Progetto diploma", "result": "Un progetto unico che ha passato tutte le fasi di sviluppo."}
    ]
  }'::jsonb
)
WHERE slug = 'scratch';