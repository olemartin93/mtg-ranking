import { addCard, count, deckScore, deckStats, exportDeck, moveCard, newDeck, parseDecklist, setQty, slimCard, validateDeck } from './deck';
import { anthem, bolt, card, forest, solRing, tokenMaker } from '../test/fixtures';

describe('deck editing', () => {
  it('adds, stacks, changes and removes cards', () => {
    let d = newDeck('Test', 'modern');
    const b = bolt();
    d = addCard(d, b);
    d = addCard(d, b);
    expect(d.entries).toHaveLength(1);
    expect(d.entries[0]?.qty).toBe(2);
    d = setQty(d, 'Lightning Bolt', 'main', 4);
    expect(count(d.entries)).toBe(4);
    d = setQty(d, 'Lightning Bolt', 'main', 0);
    expect(d.entries).toHaveLength(0);
  });

  it('moves cards between main and sideboard', () => {
    let d = addCard(newDeck('T', 'modern'), bolt(), 'main', 3);
    d = moveCard(d, 'Lightning Bolt', 'main', 'side');
    expect(count(d.entries, 'main')).toBe(0);
    expect(count(d.entries, 'side')).toBe(3);
  });

  it('stores slim cards without extra fields', () => {
    const c = { ...bolt(), artist: 'Someone' } as ReturnType<typeof bolt>;
    expect(slimCard(c)).not.toHaveProperty('artist');
    expect(slimCard(c).name).toBe('Lightning Bolt');
  });
});

describe('validateDeck', () => {
  it('flags small decks and too many copies', () => {
    const d = addCard(newDeck('T', 'modern'), bolt(), 'main', 5);
    const msgs = validateDeck(d).map((i) => i.message);
    expect(msgs.some((m) => m.includes('at least 60'))).toBe(true);
    expect(msgs.some((m) => m.includes('max 4'))).toBe(true);
  });

  it('allows any number of basic lands', () => {
    let d = addCard(newDeck('T', 'modern'), forest(), 'main', 24);
    d = addCard(d, card({ name: 'Grizzly Bears', mana_cost: '{1}{G}', color_identity: ['G'] }), 'main', 4);
    expect(validateDeck(d).some((i) => i.message.includes('Forest'))).toBe(false);
  });

  it('flags banned cards', () => {
    const banned = card({ name: 'Bad Card', legalities: { modern: 'banned' } });
    expect(validateDeck(addCard(newDeck('T', 'modern'), banned)).some((i) => i.message.includes('banned'))).toBe(true);
  });

  it('checks commander color identity and singleton', () => {
    let d = newDeck('EDH', 'commander');
    d = addCard(d, card({ name: 'Boss', type_line: 'Legendary Creature — Elf', color_identity: ['G'] }), 'commander');
    d = addCard(d, bolt(), 'main', 2);
    const msgs = validateDeck(d).map((i) => i.message);
    expect(msgs.some((m) => m.includes("outside your commander's color identity"))).toBe(true);
    expect(msgs.some((m) => m.includes('max 1 copy'))).toBe(true);
    expect(msgs.some((m) => m.includes('exactly 100'))).toBe(true);
  });
});

describe('deckStats', () => {
  it('computes curve, lands, colors, roles and price', () => {
    let d = newDeck('T', 'modern');
    d = addCard(d, bolt(), 'main', 4);
    d = addCard(d, solRing(), 'main', 1);
    d = addCard(d, forest(), 'main', 10);
    d = addCard(d, anthem(), 'side', 2);
    const s = deckStats(d.entries);
    expect(s.total).toBe(15);
    expect(s.lands).toBe(10);
    expect(s.curve[1]).toBe(5);
    expect(s.colors.R).toBe(4);
    expect(s.colors.W).toBe(0); // sideboard ignored
    expect(s.roles.removal).toBe(4);
    expect(s.roles.ramp).toBe(1);
    expect(s.priceUsd).toBe(1.5);
    expect(s.avgCmc).toBe(1);
  });
});

describe('decklist import/export', () => {
  it('parses common formats', () => {
    const lines = parseDecklist(`Commander
1 Atraxa, Praetors' Voice

Deck
4x Lightning Bolt (2X2) 117
1 Sol Ring
// comment
SB: 2 Glorious Anthem

Sideboard
3 Pyroblast`);
    expect(lines).toEqual([
      { qty: 1, name: "Atraxa, Praetors' Voice", board: 'commander' },
      { qty: 4, name: 'Lightning Bolt', board: 'main' },
      { qty: 1, name: 'Sol Ring', board: 'main' },
      { qty: 2, name: 'Glorious Anthem', board: 'side' },
      { qty: 3, name: 'Pyroblast', board: 'side' },
    ]);
  });

  it('round-trips export → parse', () => {
    let d = newDeck('T', 'modern');
    d = addCard(d, bolt(), 'main', 4);
    d = addCard(d, tokenMaker(), 'side', 2);
    const parsed = parseDecklist(exportDeck(d));
    expect(parsed).toEqual([
      { qty: 4, name: 'Lightning Bolt', board: 'main' },
      { qty: 2, name: 'Raise the Alarm', board: 'side' },
    ]);
  });
});

describe('deckScore', () => {
  it('scores a synergistic deck higher than a random one', () => {
    let good = newDeck('Tokens', 'modern');
    good = addCard(good, tokenMaker(), 'main', 4);
    good = addCard(good, anthem(), 'main', 4);
    let bad = newDeck('Pile', 'modern');
    bad = addCard(bad, bolt(), 'main', 4);
    bad = addCard(bad, solRing(), 'main', 4);
    expect(deckScore(good).synergy).toBeGreaterThan(deckScore(bad).synergy);
    expect(deckScore(good).score).toBeGreaterThanOrEqual(0);
    expect(deckScore(good).score).toBeLessThanOrEqual(100);
  });
});
