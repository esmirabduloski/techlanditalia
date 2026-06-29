
CREATE TABLE public.glossary_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL,
  slug text NOT NULL UNIQUE,
  definition text NOT NULL,
  short_definition text,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('general','scratch','python','roblox','ai','web')),
  examples jsonb DEFAULT '[]'::jsonb,
  related_terms text[] DEFAULT '{}'::text[],
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_glossary_slug ON public.glossary_terms (slug);
CREATE INDEX idx_glossary_published_category ON public.glossary_terms (is_published, category);
CREATE INDEX idx_glossary_term_lower ON public.glossary_terms (lower(term));

GRANT SELECT ON public.glossary_terms TO anon, authenticated;
GRANT ALL ON public.glossary_terms TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.glossary_terms TO authenticated;

ALTER TABLE public.glossary_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published terms"
  ON public.glossary_terms FOR SELECT
  USING (is_published = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage glossary"
  ON public.glossary_terms FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update glossary"
  ON public.glossary_terms FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete glossary"
  ON public.glossary_terms FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_glossary_terms_updated_at
  BEFORE UPDATE ON public.glossary_terms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed
INSERT INTO public.glossary_terms (term, slug, short_definition, definition, category) VALUES
('Variabile','variabile','Un contenitore con un nome dove salvare un valore.','Una **variabile** è uno spazio di memoria identificato da un nome, in cui possiamo salvare un valore (numero, testo, lista...). Si può leggere e modificare durante il programma.','general'),
('Funzione','funzione','Un blocco di codice riutilizzabile con un nome.','Una **funzione** è un insieme di istruzioni raggruppate sotto un nome. Le chiami quando ti serve, anche più volte, evitando di riscrivere lo stesso codice.','general'),
('Ciclo','ciclo','Ripetere istruzioni più volte automaticamente.','Un **ciclo** (o loop) ripete un blocco di codice finché una condizione è vera (`while`) o per un numero fisso di volte (`for`).','general'),
('Condizione','condizione','Un "se" che esegue codice diverso a seconda dei casi.','Un costrutto condizionale (`if`/`else`) permette al programma di prendere decisioni e seguire percorsi diversi.','general'),
('Algoritmo','algoritmo','Una sequenza precisa di passi per risolvere un problema.','Un **algoritmo** è la "ricetta" che un programma segue per arrivare al risultato. Anche fare la pasta è un algoritmo!','general'),
('Bug','bug','Un errore nel programma.','Un **bug** è un errore o comportamento inaspettato nel codice. Il **debug** è il processo di trovarli e correggerli.','general'),
('Debug','debug','Trovare e correggere errori nel codice.','**Debug** significa cercare e risolvere i **bug** (errori) in un programma, spesso usando strumenti che ti mostrano cosa sta facendo il codice passo passo.','general'),
('IDE','ide','L''editor speciale dove si scrive il codice.','Un **IDE** (Integrated Development Environment) è un programma per scrivere codice con aiuti integrati: colori, errori in tempo reale, esecuzione. Esempi: VS Code, PyCharm, Replit.','general'),
('API','api','Un modo standardizzato per far parlare due programmi.','Una **API** (Application Programming Interface) è un insieme di regole che permette a programmi diversi di scambiarsi dati. Es: chiamiamo l''API di OpenAI per generare testo.','general'),
('Stringa','stringa','Un testo nel codice, tra virgolette.','Una **stringa** è un valore di tipo testo, scritto tra virgolette: `"ciao"`, `''Python''`.','general'),
('Booleano','booleano','Un valore che può essere solo Vero o Falso.','Il tipo **booleano** ha solo due valori: `True` (vero) o `False` (falso). Si usa per condizioni e logica.','general'),
('Lista','lista','Una sequenza ordinata di elementi.','Una **lista** (o array) è una raccolta ordinata di valori. In Python: `[1, 2, 3]`. Puoi aggiungere, togliere e leggere elementi per posizione.','general'),
('Dizionario','dizionario','Una raccolta di coppie chiave-valore.','Un **dizionario** associa chiavi a valori, come un vocabolario. In Python: `{"nome": "Anna", "eta": 12}`.','python'),
('Sprite','sprite','Un personaggio o oggetto grafico nel gioco.','Uno **sprite** è un''immagine 2D che rappresenta un personaggio, oggetto o elemento di gioco. In Scratch ogni gatto, palla o nemico è uno sprite.','scratch'),
('Blocco','blocco','Un pezzo di codice colorato a incastro in Scratch.','In Scratch un **blocco** è un mattoncino visuale che rappresenta un''istruzione. Si incastrano insieme come Lego per creare il programma.','scratch'),
('Evento','evento','Qualcosa che succede e fa partire del codice.','Un **evento** è un''azione (clic, tasto premuto, sprite cliccato) che fa partire un pezzo di codice. In Scratch: "quando si clicca la bandiera verde".','scratch'),
('Script Lua','script-lua','Codice scritto in linguaggio Lua, usato in Roblox.','Uno **script Lua** è un file di codice nel linguaggio **Lua**, usato in Roblox Studio per dare vita a giochi e oggetti interattivi.','roblox'),
('Workspace','workspace','La cartella dove vivono tutti gli oggetti di un gioco Roblox.','In Roblox Studio il **Workspace** è il contenitore principale di tutti gli oggetti 3D del gioco (parti, modelli, personaggi).','roblox'),
('Part','part','Un oggetto 3D di base in Roblox.','Una **Part** è il mattoncino base di Roblox: un blocco 3D (cubo, sfera, cilindro) che puoi spostare, colorare e a cui puoi attaccare script.','roblox'),
('LocalScript','localscript','Script Roblox eseguito sul client (giocatore).','Un **LocalScript** è uno script Lua eseguito sul dispositivo del giocatore. Si usa per UI, input e tutto ciò che riguarda il singolo utente.','roblox'),
('Indentazione','indentazione','Gli spazi all''inizio della riga che in Python definiscono i blocchi.','In Python l''**indentazione** (spazi a inizio riga) sostituisce le parentesi graffe per delimitare i blocchi di codice. Se sbagli, il codice non funziona.','python'),
('Import','import','Caricare nel codice una libreria esterna.','`import` è la parola chiave Python per caricare un **modulo** o **libreria** e usarne le funzioni. Es: `import math`.','python'),
('Libreria','libreria','Una raccolta di codice pronto da usare.','Una **libreria** è un insieme di funzioni e classi già scritte che puoi importare per non reinventare la ruota. Es: `pygame`, `numpy`, `requests`.','python'),
('Classe','classe','Lo "stampo" da cui si creano oggetti.','Una **classe** è un modello che definisce caratteristiche (attributi) e azioni (metodi) di un tipo di oggetto. Da una classe `Cane` puoi creare tanti cani.','python'),
('Oggetto','oggetto','Un''istanza concreta creata da una classe.','Un **oggetto** è una "copia viva" creata da una **classe**. Se `Cane` è la classe, `rex = Cane()` è l''oggetto.','python'),
('AI','ai','Software che impara e prende decisioni come un cervello.','L''**Intelligenza Artificiale (AI)** è un campo dell''informatica dove i programmi imparano dai dati per riconoscere immagini, capire testi, giocare, prevedere.','ai'),
('Machine Learning','machine-learning','Insegnare a un programma a imparare dagli esempi.','Il **Machine Learning** è un ramo dell''AI in cui i modelli imparano automaticamente dai dati invece di essere programmati passo per passo.','ai'),
('Modello','modello','Un "cervello digitale" addestrato a fare qualcosa.','Un **modello** AI è il risultato dell''addestramento: un file che ha imparato a riconoscere immagini, generare testo o prevedere valori.','ai'),
('Prompt','prompt','Il messaggio che dai a un''AI per ottenere una risposta.','Un **prompt** è l''istruzione testuale che dai a un modello AI (come ChatGPT) per dirgli cosa generare. Saper scrivere buoni prompt = **prompt engineering**.','ai'),
('Dataset','dataset','Una raccolta di dati per addestrare un''AI.','Un **dataset** è una collezione di esempi (immagini, testi, numeri) usata per addestrare un modello di machine learning.','ai'),
('HTML','html','Il linguaggio per la struttura delle pagine web.','**HTML** (HyperText Markup Language) descrive la struttura di una pagina web: titoli, paragrafi, link, immagini.','web'),
('CSS','css','Il linguaggio per lo stile e la grafica delle pagine web.','**CSS** (Cascading Style Sheets) serve a stilare le pagine HTML: colori, font, layout, animazioni.','web'),
('JavaScript','javascript','Il linguaggio che rende interattive le pagine web.','**JavaScript** è il linguaggio di programmazione che gira nel browser e rende le pagine web interattive: pulsanti, form, animazioni, giochi.','web');
