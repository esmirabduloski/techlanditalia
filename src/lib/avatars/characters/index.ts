import { clampLevel, getAvatar, type AvatarSlug } from '../catalog';
import type { AvatarModel } from '../voxel';
import { astronauta } from './astronauta';
import { drago } from './drago';
import { gatto } from './gatto';
import { mago } from './mago';
import { nerd } from './nerd';
import { panda } from './panda';
import { pinguino } from './pinguino';
import { supereroe } from './supereroe';
import { unicorno } from './unicorno';
import { volpe } from './volpe';

const BUILDERS: Record<AvatarSlug, (level: number) => AvatarModel> = {
  panda, volpe, astronauta, pinguino, gatto, supereroe, mago, drago, unicorno, nerd,
};

/** Modello 3D dell'avatar `id` al livello `level` (1..10). */
export function buildAvatar(id: number, level: number): AvatarModel {
  return BUILDERS[getAvatar(id).slug](clampLevel(level));
}
