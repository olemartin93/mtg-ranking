import { analyzeSynergy, cardThemes, pairSynergy } from './synergy';
import { addCard, newDeck } from './deck';
import { anthem, bolt, card, tokenMaker } from '../test/fixtures';

describe('cardThemes', () => {
  it.each([
    ['Create two 1/1 white Soldier creature tokens.', 'tokens', 'enables'],
    ['Creatures you control get +1/+1.', 'tokens', 'rewards'],
    ['Put a +1/+1 counter on target creature.', 'counters', 'enables'],
    ['Proliferate.', 'counters', 'rewards'],
    ['Whenever another creature you control dies, each opponent loses 1 life.', 'sacrifice', 'rewards'],
    ['Sacrifice a creature: Scry 1.', 'sacrifice', 'enables'],
    ['Mill three cards.', 'graveyard', 'enables'],
    ['Return target creature card from your graveyard to the battlefield.', 'graveyard', 'rewards'],
    ['Whenever you gain life, put a +1/+1 counter on this creature.', 'lifegain', 'rewards'],
    ['Landfall — Whenever a land you control enters, draw a card.', 'landfall', 'rewards'],
    ['Whenever you draw a card, gain 1 life.', 'draw', 'rewards'],
  ] as const)('%s → %s %s', (text, theme, side) => {
    const t = cardThemes(card({ name: 'X', oracle_text: text }));
    expect(t[side]).toContain(theme);
  });

  it('treats instants as spellslinger enablers', () => {
    expect(cardThemes(bolt()).enables).toContain('spells');
  });

  it('reads oracle text from both faces of double-faced cards', () => {
    const dfc = card({ name: 'A // B', card_faces: [{ name: 'A', oracle_text: 'Mill two cards.' }, { name: 'B', oracle_text: 'Flashback {2}' }] });
    delete dfc.oracle_text;
    const t = cardThemes(dfc);
    expect(t.enables).toContain('graveyard');
    expect(t.rewards).toContain('graveyard');
  });
});

describe('pairSynergy', () => {
  it('links an enabler with a payoff', () => {
    expect(pairSynergy(tokenMaker(), anthem())).toContain('tokens');
    expect(pairSynergy(anthem(), tokenMaker())).toContain('tokens');
  });
  it('returns nothing for unrelated cards', () => {
    expect(pairSynergy(anthem(), card({ name: 'Vanilla', oracle_text: '' }))).toEqual([]);
  });
});

describe('analyzeSynergy', () => {
  it('scores a focused theme and ignores the sideboard', () => {
    let d = newDeck('T', 'modern');
    d = addCard(d, tokenMaker(), 'main', 4);
    d = addCard(d, anthem(), 'main', 4);
    d = addCard(d, card({ name: 'Side', oracle_text: 'Proliferate.' }), 'side', 3);
    const r = analyzeSynergy(d.entries);
    expect(r.themes[0]?.theme.id).toBe('tokens');
    expect(r.themes[0]?.score).toBeGreaterThan(50);
    expect(r.themes.some((t) => t.theme.id === 'counters')).toBe(false);
    expect(r.score).toBeGreaterThan(0);
  });

  it('detects tribal decks and their payoffs', () => {
    let d = newDeck('Elves', 'modern');
    d = addCard(d, card({ name: 'Elf A', type_line: 'Creature — Elf Druid' }), 'main', 4);
    d = addCard(d, card({ name: 'Elf B', type_line: 'Creature — Elf Warrior' }), 'main', 4);
    d = addCard(d, card({ name: 'Elf Lord', type_line: 'Creature — Elf', oracle_text: 'Other Elves you control get +1/+1.' }), 'main', 2);
    const r = analyzeSynergy(d.entries);
    expect(r.tribal[0]?.type).toBe('Elf');
    expect(r.tribal[0]?.count).toBe(10);
    expect(r.tribal[0]?.payoffs).toContain('Elf Lord');
  });

  it('returns zero for an empty deck', () => {
    expect(analyzeSynergy([]).score).toBe(0);
  });
});
