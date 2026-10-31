import type { ScryfallCard, ScryfallList, ScryfallSet } from './types';

/**
 * Client for the Scryfall API (https://scryfall.com/docs/api), the community's
 * standard MTG card database. Scryfall asks clients to keep 50–100 ms between
 * requests, so all calls go through a small queue.
 */
export const API = 'https://api.scryfall.com';
const MIN_GAP_MS = 100;

let last = 0;
let chain: Promise<unknown> = Promise.resolve();

function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    // Clamp so a clock that jumps backwards can't stall requests.
    const wait = Math.min(last + MIN_GAP_MS - Date.now(), MIN_GAP_MS);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

export class ScryfallError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ScryfallError';
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  if (!url.startsWith(API)) throw new Error('Refusing to call a non-Scryfall URL');
  return throttle(async () => {
    const res = await fetch(url, { ...init, headers: { Accept: 'application/json', ...(init?.headers ?? {}) } });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const details = isErrorBody(body) ? body.details : `Request failed (${res.status})`;
      throw new ScryfallError(details, res.status);
    }
    return body as T;
  });
}

function isErrorBody(v: unknown): v is { details: string } {
  return typeof v === 'object' && v !== null && 'details' in v && typeof (v as { details: unknown }).details === 'string';
}

export interface SearchOptions {
  order?: 'name' | 'released' | 'edhrec' | 'cmc' | 'usd' | 'rarity';
  dir?: 'auto' | 'asc' | 'desc';
  unique?: 'cards' | 'prints';
  page?: number;
}

export async function searchCards(q: string, opts: SearchOptions = {}): Promise<ScryfallList<ScryfallCard>> {
  const params = new URLSearchParams({ q, order: opts.order ?? 'name', dir: opts.dir ?? 'auto', unique: opts.unique ?? 'cards', page: String(opts.page ?? 1) });
  try {
    return await request<ScryfallList<ScryfallCard>>(`${API}/cards/search?${params.toString()}`);
  } catch (e) {
    // Scryfall returns 404 when a valid search simply has no results.
    if (e instanceof ScryfallError && e.status === 404) return { object: 'list', data: [], has_more: false, total_cards: 0 };
    throw e;
  }
}

export function getCard(id: string): Promise<ScryfallCard> {
  return request<ScryfallCard>(`${API}/cards/${encodeURIComponent(id)}`);
}

export async function autocomplete(q: string): Promise<string[]> {
  if (q.trim().length < 2) return [];
  const res = await request<{ data: string[] }>(`${API}/cards/autocomplete?q=${encodeURIComponent(q)}`);
  return res.data;
}

export async function getSets(): Promise<ScryfallSet[]> {
  const res = await request<{ data: ScryfallSet[] }>(`${API}/sets`);
  return res.data;
}

/** Look up many cards by name (75 per request, the Scryfall limit). */
export async function getCollection(names: string[]): Promise<{ found: ScryfallCard[]; notFound: string[] }> {
  const found: ScryfallCard[] = [];
  const notFound: string[] = [];
  for (let i = 0; i < names.length; i += 75) {
    const chunk = names.slice(i, i + 75);
    const res = await request<{ data: ScryfallCard[]; not_found: { name?: string }[] }>(`${API}/cards/collection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers: chunk.map((name) => ({ name })) }),
    });
    found.push(...res.data);
    notFound.push(...res.not_found.map((n) => n.name ?? '?'));
  }
  return { found, notFound };
}

const PLAYABLE_SET_TYPES = new Set(['core', 'expansion', 'masters', 'draft_innovation', 'commander', 'funny', 'starter', 'alchemy']);

/** Sets releasing after `today`, soonest first. */
export function upcomingSets(sets: ScryfallSet[], today: string): ScryfallSet[] {
  return sets
    .filter((s) => s.released_at !== undefined && s.released_at > today && PLAYABLE_SET_TYPES.has(s.set_type))
    .sort((a, b) => (a.released_at ?? '').localeCompare(b.released_at ?? ''));
}

/** Sets released within the last `days` days, newest first. */
export function recentSets(sets: ScryfallSet[], today: string, days = 45): ScryfallSet[] {
  const from = new Date(new Date(today).getTime() - days * 86_400_000).toISOString().slice(0, 10);
  return sets
    .filter((s) => s.released_at !== undefined && s.released_at <= today && s.released_at >= from && PLAYABLE_SET_TYPES.has(s.set_type))
    .sort((a, b) => (b.released_at ?? '').localeCompare(a.released_at ?? ''));
}

export function cardImage(card: ScryfallCard, size: 'small' | 'normal' | 'large' = 'normal'): string | undefined {
  return card.image_uris?.[size] ?? card.card_faces?.[0]?.image_uris?.[size];
}

export function cardText(card: ScryfallCard): string {
  if (card.oracle_text !== undefined) return card.oracle_text;
  return (card.card_faces ?? []).map((f) => f.oracle_text ?? '').join('\n');
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
