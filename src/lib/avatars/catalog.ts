/**
 * Catalogo degli avatar. Gli id coincidono con profiles.avatar_id, che nel
 * database ha CHECK 1..10 e DEFAULT 1: per questo gli id restano quelli delle
 * vecchie emoji. Chi aveva un animale o una persona lo ritrova; gli slot degli
 * oggetti (1 Robot, 3 Razzo, 4 Gamer) sono passati a Panda, Astronauta e
 * Pinguino.
 *
 * Ogni personaggio ha 10 forme, una per livello di gamification (LEVELS in
 * LevelBadge.tsx): i nomi compaiono nei tooltip e nella festa di nuovo livello.
 */

export type AvatarSlug =
  | 'panda'
  | 'volpe'
  | 'astronauta'
  | 'pinguino'
  | 'gatto'
  | 'supereroe'
  | 'mago'
  | 'drago'
  | 'unicorno'
  | 'nerd';

/** Immagine a corpo intero (con il basamento) o primo piano della testa. */
export type Framing = 'full' | 'face';

export interface AvatarCharacter {
  id: number;
  slug: AvatarSlug;
  emoji: string;
  name: string;
  /** Nome della forma ai livelli 1..10. */
  stages: string[];
}

export const AVATAR_CHARACTERS: AvatarCharacter[] = [
  {
    id: 1, slug: 'panda', emoji: '🐼', name: 'Panda',
    stages: ['Cucciolo di panda', 'Mangiabambù', 'Cintura bianca', 'Cintura gialla', 'Cintura arancione',
      'Cintura verde', 'Cintura nera', 'Guerriero del bambù', 'Viandante', 'Gran maestro'],
  },
  {
    id: 2, slug: 'volpe', emoji: '🦊', name: 'Volpe Tech',
    stages: ['Cucciolo di volpe', 'Volpina', 'Volpe col collare', 'Volpe DJ', 'Volpe a due code',
      'Volpe esploratrice', 'Volpe a tre code', 'Volpe a cinque code', 'Volpe a sette code', 'Kitsune leggendaria'],
  },
  {
    id: 3, slug: 'astronauta', emoji: '🧑‍🚀', name: 'Astronauta',
    stages: ['Sognatore spaziale', 'Piccolo razzo', 'Cadetto', 'Pilota', 'Astronauta',
      'Passeggiatore spaziale', 'Esploratore lunare', 'Pilota di jetpack', 'Astronauta volante', 'Comandante stellare'],
  },
  {
    id: 4, slug: 'pinguino', emoji: '🐧', name: 'Pinguino',
    stages: ['Pulcino', 'Pulcino curioso', 'Pinguino giovane', 'Pinguino del polo', 'Pinguino elegante',
      'Pinguino viaggiatore', 'Pescatore provetto', 'Principe dei ghiacci', 'Signore del ghiaccio', 'Imperatore'],
  },
  {
    id: 5, slug: 'gatto', emoji: '🐱', name: 'Gatto Ninja',
    stages: ['Gattino', 'Gattino col campanello', 'Allievo', 'Apprendista ninja', 'Spadaccino di legno',
      'Ninja silenzioso', 'Ninja della katana', 'Ninja delle stelle', 'Ombra della notte', 'Gran maestro ninja'],
  },
  {
    id: 6, slug: 'supereroe', emoji: '🦸', name: 'Supereroe',
    stages: ['Piccolo eroe', 'Eroe in pigiama', 'Eroe col distintivo', 'Aspirante eroe', 'Eroe di quartiere',
      'Eroe in addestramento', 'Supereroe', 'Eroe luminoso', 'Eroe volante', 'Leggenda dei supereroi'],
  },
  {
    id: 7, slug: 'mago', emoji: '🧙', name: 'Mago',
    stages: ['Apprendista', 'Mago del rametto', 'Studente di magia', 'Mago della bacchetta', 'Mago stellato',
      'Mago col mantello', 'Mago dei libri', 'Mago del bastone', 'Mago dei cristalli', 'Arcimago'],
  },
  {
    id: 8, slug: 'drago', emoji: '🐉', name: 'Drago',
    stages: ['Uovo misterioso', 'Draghetto appena nato', 'Draghetto', 'Draghetto alato', 'Drago crestato',
      'Drago cornuto', 'Drago delle vette', 'Drago fumante', 'Drago di fuoco', 'Drago leggendario'],
  },
  {
    id: 9, slug: 'unicorno', emoji: '🦄', name: 'Unicorno',
    stages: ['Puledro', 'Puledro allegro', 'Puledro magico', 'Unicorno giovane', 'Unicorno del corno a spirale',
      'Unicorno fiorito', 'Unicorno arcobaleno', 'Unicorno splendente', 'Unicorno alato', 'Alicorno'],
  },
  {
    id: 10, slug: 'nerd', emoji: '🤓', name: 'Nerd',
    stages: ['Piccolo curioso', 'Elica in testa', 'Zaino in spalla', 'Programmatore in erba', 'Smanettone',
      'Scienziato', 'Ricercatore', 'Inventore', 'Hacker etico', 'Genio'],
  },
];

/** Avatar di un profilo; id sconosciuti tornano al default del database (1). */
export function getAvatar(id: number | null | undefined): AvatarCharacter {
  return AVATAR_CHARACTERS.find((a) => a.id === id) ?? AVATAR_CHARACTERS[0];
}

export function clampLevel(level: number) {
  return Math.min(10, Math.max(1, Math.round(level || 1)));
}

export function stageName(id: number, level: number) {
  return getAvatar(id).stages[clampLevel(level) - 1];
}
