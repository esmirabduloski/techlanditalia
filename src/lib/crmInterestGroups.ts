/**
 * Normalizzazione del campo "interesse" dei lead CRM in gruppi-corso leggibili.
 * I form salvano a volte lo slug (roblox, python-base) e a volte l'etichetta completa.
 */

export interface InterestGroup {
  key: string;
  label: string;
  emoji: string;
}

const GROUPS: (InterestGroup & { match: RegExp })[] = [
  { key: "roblox-pro", label: "Roblox PRO", emoji: "🚀", match: /roblox.*(avanz|pro)|avanzat[ao].*roblox/i },
  { key: "roblox", label: "Roblox", emoji: "🎮", match: /roblox/i },
  { key: "minecraft", label: "Minecraft", emoji: "⛏️", match: /minecraft/i },
  { key: "scratch", label: "Scratch", emoji: "🐱", match: /scratch|programmazione visiva/i },
  { key: "python-ai", label: "Python & AI", emoji: "🤖", match: /(python.*(ai|pro|avanz))|intelligenza artificiale|\bai\b/i },
  { key: "python", label: "Python", emoji: "🐍", match: /python/i },
  { key: "web", label: "Sviluppo Web", emoji: "🌐", match: /web|html|css|sito/i },
  { key: "design", label: "Design creativo", emoji: "🎨", match: /design|grafica/i },
  { key: "informatica", label: "ABC Informatica", emoji: "💻", match: /abc|informatica|computer/i },
  { key: "non-so", label: "Da definire", emoji: "❓", match: /non[-\s]?so|non lo so|altro/i },
];

export const UNKNOWN_GROUP: InterestGroup = {
  key: "__none__",
  label: "Senza corso indicato",
  emoji: "📭",
};

export function getInterestGroup(interest?: string | null): InterestGroup {
  const raw = (interest ?? "").trim();
  if (!raw) return UNKNOWN_GROUP;
  const found = GROUPS.find((g) => g.match.test(raw));
  if (found) return { key: found.key, label: found.label, emoji: found.emoji };
  return { key: `other:${raw.toLowerCase()}`, label: raw, emoji: "📚" };
}

/** Raggruppa una lista di elementi per gruppo-corso, ordinando per numerosità. */
export function groupByInterest<T>(
  items: T[],
  getInterest: (item: T) => string | null | undefined,
): { group: InterestGroup; items: T[] }[] {
  const map = new Map<string, { group: InterestGroup; items: T[] }>();
  items.forEach((item) => {
    const group = getInterestGroup(getInterest(item));
    const entry = map.get(group.key);
    if (entry) entry.items.push(item);
    else map.set(group.key, { group, items: [item] });
  });
  return Array.from(map.values()).sort((a, b) => {
    if (a.group.key === UNKNOWN_GROUP.key) return 1;
    if (b.group.key === UNKNOWN_GROUP.key) return -1;
    if (b.items.length !== a.items.length) return b.items.length - a.items.length;
    return a.group.label.localeCompare(b.group.label);
  });
}
