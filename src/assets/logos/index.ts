/**
 * Loghi dei corsi importati come asset Vite: finiscono in /assets/<nome>-<hash>.<ext>
 * e ricevono Cache-Control immutable dall'hosting, a differenza dei file in
 * public/images/ che vengono serviti senza alcun header di cache (Lighthouse:
 * "Utilizza durate della memorizzazione nella cache efficienti").
 *
 * I .webp sono versioni a 128 px (i loghi sono mostrati al massimo a 44 px CSS,
 * quindi 128 px coprono anche gli schermi 3x): pesano circa la metà degli originali.
 * Con assetsInlineLimit (vite.config.ts) restano file separati e non data URI,
 * così l'HTML prerenderato non li ripete inline a ogni occorrenza.
 */
import minecraftLogo from './minecraft-logo.webp';
import pythonLogo from './python-logo.webp';
import robloxLogo from './roblox-logo.webp';
import scratchLogo from './scratch-logo.svg';

export { minecraftLogo, pythonLogo, robloxLogo, scratchLogo };
