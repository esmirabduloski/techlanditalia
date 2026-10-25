import { clampLevel, getAvatar, type Framing } from './catalog';

/**
 * Immagini pre-renderizzate dei modelli 3D (npm run avatars:render). Stanno in
 * src/assets perché Vite ne mette l'hash nel nome e l'hosting le tiene in cache;
 * l'import eager porta nel bundle solo gli URL, i file si scaricano quando servono.
 */
const files = import.meta.glob('../../assets/avatars/*/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function avatarImagePath(slug: string, level: number, framing: Framing) {
  return `../../assets/avatars/${slug}/${level}${framing === 'face' ? '-face' : ''}.webp`;
}

export function getAvatarImage(id: number, level: number, framing: Framing = 'full'): string | undefined {
  return files[avatarImagePath(getAvatar(id).slug, clampLevel(level), framing)];
}
