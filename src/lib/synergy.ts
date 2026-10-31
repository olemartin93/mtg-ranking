import type { DeckEntry, ScryfallCard } from './types';
import { cardText } from './scryfall';

/**
 * Rule-based synergy detection. Each theme has "enablers" (cards that produce
 * a resource) and "payoffs" (cards that reward it). A theme is strong when a
 * deck has plenty of both. Patterns run against Oracle text from Scryfall.
 */
export interface Theme {
  id: string;
  name: string;
  description: string;
  enabler: (c: ScryfallCard, text: string) => boolean;
  payoff: (c: ScryfallCard, text: string) => boolean;
  /** Scryfall query used to suggest more payoffs for this theme. */
  suggestQuery: string;
}

const has = (re: RegExp) => (_c: ScryfallCard, t: string) => re.test(t);
const isType = (type: string) => (c: ScryfallCard) => c.type_line.includes(type);

export const THEMES: Theme[] = [
  {
    id: 'tokens',
    name: 'Tokens / Go wide',
    description: 'Make lots of creature tokens and reward having many creatures.',
    enabler: has(/create[s]? (?:a|an|one|two|three|four|five|x|that many|\d+)? ?(?:[\w/+-]+ )*?creature tokens?/i),
    payoff: has(/creatures you control get \+|for each creature you control|whenever (?:a|another|one or more)(?: nontoken)? creatures? (?:you control )?enters?|convoke/i),
    suggestQuery: '(o:"creatures you control get +" or o:"for each creature you control")',
  },
  {
    id: 'counters',
    name: '+1/+1 counters',
    description: 'Put +1/+1 counters on creatures and benefit from them.',
    enabler: has(/(?:put|with|enters? with) (?:a|an|one|two|three|x|that many|\d+|additional)? ?\+1\/\+1 counters?/i),
    payoff: has(/proliferate|whenever (?:you put )?one or more \+1\/\+1 counters|with a \+1\/\+1 counter on it|double the number of/i),
    suggestQuery: '(o:proliferate or o:"with a +1/+1 counter on it" or o:"one or more +1/+1 counters")',
  },
  {
    id: 'sacrifice',
    name: 'Sacrifice / Aristocrats',
    description: 'Sacrifice creatures for value and profit when they die.',
    enabler: has(/sacrifice (?:a|another|an?) (?:creature|permanent|artifact)|create[s]? .*treasure/i),
    payoff: has(/whenever (?:a|another|one or more)(?: nontoken)? creatures?(?: you control)? dies|whenever you sacrifice/i),
    suggestQuery: '(o:"whenever another creature you control dies" or o:"whenever you sacrifice")',
  },
  {
    id: 'graveyard',
    name: 'Graveyard',
    description: 'Fill your graveyard and play cards from it.',
    enabler: has(/\bmills?\b|surveil|discard (?:a|two|one or more) cards?|put .* into your graveyard|self-mill/i),
    payoff: has(/from your graveyard|flashback|escape|unearth|delve|disturb|reanimate|embalm|eternalize/i),
    suggestQuery: '(o:"from your graveyard to the battlefield" or keyword:flashback or keyword:escape)',
  },
  {
    id: 'lifegain',
    name: 'Lifegain',
    description: 'Gain life repeatedly and trigger lifegain payoffs.',
    enabler: (c, t) => /gains? \d+ life|gain life|lifelink/i.test(t) || (c.keywords ?? []).includes('Lifelink'),
    payoff: has(/whenever you gain life|if you(?:'ve)? gained life|life total/i),
    suggestQuery: 'o:"whenever you gain life"',
  },
  {
    id: 'spells',
    name: 'Spellslinger',
    description: 'Cast many instants and sorceries.',
    enabler: (c) => isType('Instant')(c) || isType('Sorcery')(c),
    payoff: (c, t) => /whenever you cast (?:an|a) (?:instant|sorcery|noncreature)|prowess|magecraft/i.test(t) || (c.keywords ?? []).includes('Prowess'),
    suggestQuery: '(o:"whenever you cast an instant or sorcery" or keyword:prowess or keyword:magecraft)',
  },
  {
    id: 'artifacts',
    name: 'Artifacts',
    description: 'Play or create many artifacts.',
    enabler: (c, t) => isType('Artifact')(c) || /create[s]? .*(?:treasure|clue|food|blood|map|artifact) tokens?/i.test(t),
    payoff: has(/whenever (?:an|one or more|another) (?:nontoken )?artifacts?|artifacts? you control|for each artifact|affinity for artifacts|improvise|metalcraft/i),
    suggestQuery: '(o:"for each artifact you control" or o:"whenever an artifact you control" or keyword:improvise)',
  },
  {
    id: 'enchantments',
    name: 'Enchantments',
    description: 'Play many enchantments and trigger constellation-style effects.',
    enabler: isType('Enchantment'),
    payoff: has(/constellation|whenever (?:an|another) enchantment|enchantments? you control|for each enchantment/i),
    suggestQuery: '(keyword:constellation or o:"whenever an enchantment you control enters" or o:"for each enchantment you control")',
  },
  {
    id: 'landfall',
    name: 'Landfall',
    description: 'Put extra lands onto the battlefield.',
    enabler: has(/search your library for (?:a|up to \w+) (?:basic )?lands?|play an additional land|put (?:a|up to \w+) lands? cards? .*onto the battlefield/i),
    payoff: has(/landfall|whenever a land (?:you control )?enters/i),
    suggestQuery: '(keyword:landfall or o:"whenever a land you control enters")',
  },
  {
    id: 'blink',
    name: 'Blink / ETB',
    description: 'Flicker creatures to reuse their enter-the-battlefield abilities.',
    enabler: has(/exile (?:another )?(?:target|up to \w+ target)? ?(?:creature|permanent|nonland permanent)s?(?: you control)?,? then return (?:it|them|that card)|return (?:it|that card|them) to the battlefield under (?:its|your) owner/i),
    payoff: has(/when (?:this creature|this permanent|~|[A-Z][\w ,'-]+) enters/),
    suggestQuery: '(o:"exile another target creature you control, then return")',
  },
  {
    id: 'draw',
    name: 'Card draw matters',
    description: 'Draw extra cards and get rewarded for it.',
    enabler: has(/draws? (?:a|two|three|four|x|\d+) (?:additional )?cards?/i),
    payoff: has(/whenever you draw (?:a|your second) card/i),
    suggestQuery: 'o:"whenever you draw a card"',
  },
];

/** Matches a creature type and its plural, e.g. Elf/Elves, Zombie/Zombies. */
export function typeMention(type: string): RegExp {
  const plural = type.endsWith('f') ? `${type.slice(0, -1)}ves` : type.endsWith('s') ? `${type}es` : `${type}s`;
  return new RegExp(`\\b(?:${type}|${plural})\\b`);
}

const TRIBAL_IGNORE = new Set(['Human', 'Wizard', 'Warrior', 'Soldier', 'Shaman', 'Cleric', 'Rogue']);

export interface ThemeResult {
  theme: Theme;
  enablers: string[];
  payoffs: string[];
  /** 0–100 strength of this theme in the deck. */
  score: number;
}

export interface TribalResult {
  type: string;
  count: number;
  payoffs: string[];
}

export interface SynergyReport {
  themes: ThemeResult[];
  tribal: TribalResult[];
  /** Overall synergy score 0–100. */
  score: number;
}

export function cardThemes(card: ScryfallCard): { enables: string[]; rewards: string[] } {
  const text = cardText(card);
  const enables: string[] = [];
  const rewards: string[] = [];
  for (const t of THEMES) {
    if (t.enabler(card, text)) enables.push(t.id);
    if (t.payoff(card, text)) rewards.push(t.id);
  }
  return { enables, rewards };
}

function creatureTypes(card: ScryfallCard): string[] {
  const parts = card.type_line.split('—');
  if (!/Creature|Kindred|Tribal/.test(parts[0] ?? '') || parts[1] === undefined) return [];
  return parts[1].split('//')[0]!.trim().split(/\s+/).filter(Boolean);
}

function themeScore(enablers: number, payoffs: number, deckSize: number): number {
  if (enablers === 0 || payoffs === 0) return 0;
  // Ideal deck has ~15% enablers and ~10% payoffs for a theme.
  const scale = Math.max(deckSize, 1);
  const e = Math.min(enablers / (scale * 0.15), 1);
  const p = Math.min(payoffs / (scale * 0.1), 1);
  return Math.round(Math.sqrt(e * p) * 100);
}

export function analyzeSynergy(entries: DeckEntry[]): SynergyReport {
  const cards = entries.filter((e) => e.board !== 'side');
  const nonLand = cards.filter((e) => !e.card.type_line.includes('Land'));
  const size = nonLand.reduce((n, e) => n + e.qty, 0);

  const themes: ThemeResult[] = THEMES.map((theme) => {
    const enablers: string[] = [];
    const payoffs: string[] = [];
    let eCount = 0;
    let pCount = 0;
    for (const { card, qty } of nonLand) {
      const text = cardText(card);
      if (theme.enabler(card, text)) { enablers.push(card.name); eCount += qty; }
      if (theme.payoff(card, text)) { payoffs.push(card.name); pCount += qty; }
    }
    return { theme, enablers, payoffs, score: themeScore(eCount, pCount, size) };
  })
    .filter((t) => t.enablers.length + t.payoffs.length > 0)
    .sort((a, b) => b.score - a.score || b.enablers.length + b.payoffs.length - (a.enablers.length + a.payoffs.length));

  const typeCounts = new Map<string, number>();
  for (const { card, qty } of cards) for (const t of creatureTypes(card)) typeCounts.set(t, (typeCounts.get(t) ?? 0) + qty);
  const tribal: TribalResult[] = [...typeCounts.entries()]
    .filter(([type, count]) => count >= 5 && !TRIBAL_IGNORE.has(type))
    .map(([type, count]) => ({
      type,
      count,
      payoffs: cards.filter(({ card }) => typeMention(type).test(cardText(card))).map((e) => e.card.name),
    }))
    .sort((a, b) => b.count - a.count);

  const top = themes.slice(0, 3).map((t) => t.score);
  const tribalBonus = tribal[0] !== undefined && tribal[0].payoffs.length > 0 ? 15 : 0;
  const score = Math.min(100, Math.round((top[0] ?? 0) * 0.6 + (top[1] ?? 0) * 0.25 + (top[2] ?? 0) * 0.15 + tribalBonus));
  return { themes, tribal, score };
}

/** Theme ids two cards share (one enables what the other rewards). */
export function pairSynergy(a: ScryfallCard, b: ScryfallCard): string[] {
  const ta = cardThemes(a);
  const tb = cardThemes(b);
  const out = new Set<string>();
  for (const id of ta.enables) if (tb.rewards.includes(id)) out.add(id);
  for (const id of tb.enables) if (ta.rewards.includes(id)) out.add(id);
  return [...out];
}
