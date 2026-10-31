import type { Board, Deck, DeckEntry, Format, ScryfallCard } from './types';
import { cardText } from './scryfall';
import { analyzeSynergy } from './synergy';

export const FORMATS: { id: Format; name: string; size: number; maxCopies: number }[] = [
  { id: 'commander', name: 'Commander', size: 100, maxCopies: 1 },
  { id: 'standard', name: 'Standard', size: 60, maxCopies: 4 },
  { id: 'pioneer', name: 'Pioneer', size: 60, maxCopies: 4 },
  { id: 'modern', name: 'Modern', size: 60, maxCopies: 4 },
  { id: 'legacy', name: 'Legacy', size: 60, maxCopies: 4 },
  { id: 'vintage', name: 'Vintage', size: 60, maxCopies: 4 },
  { id: 'pauper', name: 'Pauper', size: 60, maxCopies: 4 },
];

export function formatInfo(f: Format) {
  return FORMATS.find((x) => x.id === f) ?? FORMATS[0]!;
}

export function newDeck(name: string, format: Format): Deck {
  const now = Date.now();
  return { id: crypto.randomUUID(), name, format, entries: [], createdAt: now, updatedAt: now };
}

/** Keep only the card fields the app needs so localStorage stays small. */
export function slimCard(c: ScryfallCard): ScryfallCard {
  const slim: ScryfallCard = {
    object: 'card', id: c.id, name: c.name, cmc: c.cmc, type_line: c.type_line, color_identity: c.color_identity,
    legalities: c.legalities, set: c.set, set_name: c.set_name, rarity: c.rarity, released_at: c.released_at,
  };
  if (c.oracle_id !== undefined) slim.oracle_id = c.oracle_id;
  if (c.mana_cost !== undefined) slim.mana_cost = c.mana_cost;
  if (c.oracle_text !== undefined) slim.oracle_text = c.oracle_text;
  if (c.colors !== undefined) slim.colors = c.colors;
  if (c.keywords !== undefined) slim.keywords = c.keywords;
  if (c.image_uris !== undefined) slim.image_uris = c.image_uris;
  if (c.card_faces !== undefined) slim.card_faces = c.card_faces;
  if (c.prices !== undefined) slim.prices = c.prices;
  if (c.edhrec_rank !== undefined) slim.edhrec_rank = c.edhrec_rank;
  return slim;
}

export function addCard(deck: Deck, card: ScryfallCard, board: Board = 'main', qty = 1): Deck {
  const entries = [...deck.entries];
  const i = entries.findIndex((e) => e.card.name === card.name && e.board === board);
  if (i >= 0) {
    const e = entries[i]!;
    entries[i] = { ...e, qty: e.qty + qty };
  } else {
    entries.push({ card: slimCard(card), qty, board });
  }
  return { ...deck, entries, updatedAt: Date.now() };
}

export function setQty(deck: Deck, name: string, board: Board, qty: number): Deck {
  const entries = deck.entries
    .map((e) => (e.card.name === name && e.board === board ? { ...e, qty } : e))
    .filter((e) => e.qty > 0);
  return { ...deck, entries, updatedAt: Date.now() };
}

export function moveCard(deck: Deck, name: string, from: Board, to: Board): Deck {
  const entry = deck.entries.find((e) => e.card.name === name && e.board === from);
  if (entry === undefined) return deck;
  const removed = setQty(deck, name, from, 0);
  return addCard(removed, entry.card, to, entry.qty);
}

export const count = (entries: DeckEntry[], board?: Board) =>
  entries.filter((e) => board === undefined || e.board === board).reduce((n, e) => n + e.qty, 0);

const isLand = (c: ScryfallCard) => c.type_line.includes('Land');
const isBasic = (c: ScryfallCard) => c.type_line.includes('Basic') && isLand(c);

export interface DeckStats {
  total: number;
  lands: number;
  avgCmc: number;
  curve: number[]; // index 0..7 (7 = 7+)
  colors: Record<'W' | 'U' | 'B' | 'R' | 'G' | 'C', number>;
  types: Record<string, number>;
  priceUsd: number;
  roles: { ramp: number; draw: number; removal: number; wipes: number };
}

const TYPE_ORDER = ['Creature', 'Planeswalker', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Battle', 'Land'] as const;

export function primaryType(c: ScryfallCard): string {
  const front = c.type_line.split('//')[0] ?? c.type_line;
  return TYPE_ORDER.find((t) => front.includes(t)) ?? 'Other';
}

export function cardRoles(c: ScryfallCard): { ramp: boolean; draw: boolean; removal: boolean; wipe: boolean } {
  const t = cardText(c);
  return {
    ramp: !isLand(c) && (/add \{[WUBRGC]\}|add (?:one|two|three) mana|search your library for (?:a|up to \w+) (?:basic )?lands?.*battlefield/is.test(t)),
    draw: /draws? (?:a|two|three|four|x|\d+) cards?|investigate/i.test(t),
    removal: /(?:destroy|exile) target (?:creature|artifact|enchantment|planeswalker|nonland permanent|permanent)|deals? (?:\d+|x) damage to (?:target|any target)|counter target spell/i.test(t),
    wipe: /(?:destroy|exile) all (?:creatures|nonland permanents|other creatures)|all creatures get -/i.test(t),
  };
}

export function deckStats(entries: DeckEntry[]): DeckStats {
  const main = entries.filter((e) => e.board !== 'side');
  const curve = Array.from({ length: 8 }, () => 0);
  const colors = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  const types: Record<string, number> = {};
  const roles = { ramp: 0, draw: 0, removal: 0, wipes: 0 };
  let lands = 0;
  let cmcSum = 0;
  let spells = 0;
  let priceUsd = 0;
  for (const { card, qty } of main) {
    const type = primaryType(card);
    types[type] = (types[type] ?? 0) + qty;
    priceUsd += Number(card.prices?.usd ?? 0) * qty;
    if (isLand(card)) { lands += qty; continue; }
    spells += qty;
    cmcSum += card.cmc * qty;
    curve[Math.min(Math.floor(card.cmc), 7)]! += qty;
    const cost = card.mana_cost ?? card.card_faces?.map((f) => f.mana_cost ?? '').join('') ?? '';
    for (const sym of cost.match(/\{[^}]+\}/g) ?? []) {
      for (const k of ['W', 'U', 'B', 'R', 'G', 'C'] as const) if (sym.includes(k)) colors[k] += qty;
    }
    const r = cardRoles(card);
    if (r.ramp) roles.ramp += qty;
    if (r.draw) roles.draw += qty;
    if (r.removal) roles.removal += qty;
    if (r.wipe) roles.wipes += qty;
  }
  return { total: lands + spells, lands, avgCmc: spells ? Math.round((cmcSum / spells) * 100) / 100 : 0, curve, colors, types, priceUsd: Math.round(priceUsd * 100) / 100, roles };
}

export interface Issue {
  level: 'error' | 'warning';
  message: string;
}

export function validateDeck(deck: Deck): Issue[] {
  const info = formatInfo(deck.format);
  const issues: Issue[] = [];
  const main = count(deck.entries, 'main') + count(deck.entries, 'commander');
  const side = count(deck.entries, 'side');
  if (deck.format === 'commander') {
    if (main !== 100) issues.push({ level: 'error', message: `Commander decks need exactly 100 cards (you have ${main}).` });
    const commanders = deck.entries.filter((e) => e.board === 'commander');
    if (commanders.length === 0) issues.push({ level: 'error', message: 'Choose a commander.' });
    const identity = new Set(commanders.flatMap((e) => e.card.color_identity));
    if (commanders.length > 0) {
      for (const e of deck.entries) {
        if (e.board !== 'commander' && e.card.color_identity.some((c) => !identity.has(c))) issues.push({ level: 'error', message: `${e.card.name} is outside your commander's color identity.` });
      }
    }
  } else {
    if (main < info.size) issues.push({ level: 'error', message: `Main deck needs at least ${info.size} cards (you have ${main}).` });
    if (side > 15) issues.push({ level: 'error', message: `Sideboard can have at most 15 cards (you have ${side}).` });
  }
  const byName = new Map<string, { card: ScryfallCard; qty: number }>();
  for (const e of deck.entries) {
    const cur = byName.get(e.card.name);
    byName.set(e.card.name, { card: e.card, qty: (cur?.qty ?? 0) + e.qty });
  }
  for (const { card, qty } of byName.values()) {
    const legality = card.legalities[deck.format];
    if (legality === 'banned') issues.push({ level: 'error', message: `${card.name} is banned in ${info.name}.` });
    else if (legality === 'not_legal') issues.push({ level: 'error', message: `${card.name} is not legal in ${info.name}.` });
    const unlimited = isBasic(card) || /any number of cards named/i.test(cardText(card));
    const max = legality === 'restricted' ? 1 : info.maxCopies;
    if (!unlimited && qty > max) issues.push({ level: 'error', message: `${card.name}: max ${max} ${max === 1 ? 'copy' : 'copies'} (you have ${qty}).` });
  }
  const stats = deckStats(deck.entries);
  if (stats.total > 0) {
    const landRatio = stats.lands / stats.total;
    if (landRatio < 0.33) issues.push({ level: 'warning', message: `Only ${stats.lands} lands — most decks want 36–42% lands.` });
    if (landRatio > 0.46) issues.push({ level: 'warning', message: `${stats.lands} lands is a lot — consider cutting a few.` });
    if (deck.format === 'commander') {
      if (stats.roles.ramp < 8) issues.push({ level: 'warning', message: `Low ramp (${stats.roles.ramp}). Commander decks usually run ~10.` });
      if (stats.roles.draw < 8) issues.push({ level: 'warning', message: `Low card draw (${stats.roles.draw}). Aim for ~10.` });
      if (stats.roles.removal < 6) issues.push({ level: 'warning', message: `Low removal (${stats.roles.removal}). Aim for 8+.` });
    }
  }
  return issues;
}

/** 0–100 overall rating used to rank your decks. */
export function deckScore(deck: Deck): { score: number; synergy: number; curve: number; legal: boolean } {
  const issues = validateDeck(deck);
  const legal = !issues.some((i) => i.level === 'error');
  const synergy = analyzeSynergy(deck.entries).score;
  const stats = deckStats(deck.entries);
  // Curve health: reward an average mana value near 3 (60-card) or 3.3 (Commander).
  const target = deck.format === 'commander' ? 3.3 : 2.9;
  const curve = stats.total === 0 ? 0 : Math.max(0, Math.round(100 - Math.abs(stats.avgCmc - target) * 40));
  const warnings = issues.filter((i) => i.level === 'warning').length;
  const score = Math.max(0, Math.round(synergy * 0.5 + curve * 0.3 + (legal ? 20 : 0) - warnings * 3));
  return { score: Math.min(100, score), synergy, curve, legal };
}

/** Export as a plain text decklist (MTG Arena / MTGO style). */
export function exportDeck(deck: Deck): string {
  const section = (b: Board) => deck.entries.filter((e) => e.board === b).map((e) => `${e.qty} ${e.card.name}`);
  const parts: string[] = [];
  const cmd = section('commander');
  if (cmd.length) parts.push('Commander', ...cmd, '');
  parts.push('Deck', ...section('main'));
  const side = section('side');
  if (side.length) parts.push('', 'Sideboard', ...side);
  return parts.join('\n');
}

export interface ParsedLine {
  qty: number;
  name: string;
  board: Board;
}

/** Parse a text decklist: "4 Lightning Bolt", "1x Sol Ring (CMR) 472", section headers. */
export function parseDecklist(text: string): ParsedLine[] {
  let board: Board = 'main';
  const out: ParsedLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') {
      if (out.length > 0) board = board === 'commander' ? 'main' : 'side';
      continue;
    }
    const header = line.toLowerCase().replace(/:$/, '');
    if (header === 'commander') { board = 'commander'; continue; }
    if (header === 'deck' || header === 'main' || header === 'mainboard') { board = 'main'; continue; }
    if (header === 'sideboard' || header === 'side') { board = 'side'; continue; }
    if (line.startsWith('//') || line.startsWith('#')) continue;
    const m = /^(?:SB:\s*)?(\d+)\s*x?\s+(.+?)(?:\s+\([A-Z0-9]+\)(?:\s+\S+)?)?(?:\s+\*F\*)?$/i.exec(line);
    if (m === null) continue;
    out.push({ qty: Number(m[1]), name: m[2]!.trim(), board: line.toUpperCase().startsWith('SB:') ? 'side' : board });
  }
  return out;
}
