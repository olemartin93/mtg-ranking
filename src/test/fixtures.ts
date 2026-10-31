import type { ScryfallCard } from '../lib/types';

let n = 0;
const legalAll = { commander: 'legal', standard: 'legal', pioneer: 'legal', modern: 'legal', legacy: 'legal', vintage: 'legal', pauper: 'legal' } as const;

export function card(over: Partial<ScryfallCard> & { name: string }): ScryfallCard {
  n += 1;
  return {
    object: 'card',
    id: `id-${n}-${over.name.replace(/\W/g, '')}`,
    cmc: 2,
    type_line: 'Creature — Human',
    color_identity: [],
    legalities: { ...legalAll },
    set: 'tst',
    set_name: 'Test Set',
    rarity: 'common',
    released_at: '2024-01-01',
    oracle_text: '',
    image_uris: { normal: `https://cards.scryfall.io/normal/${n}.jpg`, small: `https://cards.scryfall.io/small/${n}.jpg` },
    ...over,
  };
}

export const forest = () => card({ name: 'Forest', type_line: 'Basic Land — Forest', cmc: 0, color_identity: ['G'] });
export const solRing = () => card({ name: 'Sol Ring', type_line: 'Artifact', cmc: 1, mana_cost: '{1}', oracle_text: '{T}: Add {C}{C}.', prices: { usd: '1.50' } });
export const bolt = () => card({ name: 'Lightning Bolt', type_line: 'Instant', cmc: 1, mana_cost: '{R}', color_identity: ['R'], oracle_text: 'Lightning Bolt deals 3 damage to any target.' });
export const tokenMaker = () => card({ name: 'Raise the Alarm', type_line: 'Instant', cmc: 2, mana_cost: '{1}{W}', color_identity: ['W'], oracle_text: 'Create two 1/1 white Soldier creature tokens.' });
export const anthem = () => card({ name: 'Glorious Anthem', type_line: 'Enchantment', cmc: 3, mana_cost: '{1}{W}{W}', color_identity: ['W'], oracle_text: 'Creatures you control get +1/+1.' });

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
