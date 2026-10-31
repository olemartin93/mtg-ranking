import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './test/render';
import { anthem, bolt, card, jsonResponse, tokenMaker } from './test/fixtures';
import { addCard, newDeck } from './lib/deck';
import { loadDecks, saveDecks } from './lib/storage';
import { buildQuery } from './pages/SearchPage';
import { suggestionQuery } from './pages/DeckPage';
import { RANKING_QUERIES } from './pages/RankingsPage';
import { analyzeSynergy } from './lib/synergy';
import type { ScryfallCard } from './lib/types';

const fetchMock = vi.fn<typeof fetch>();
const list = (data: ScryfallCard[]) => jsonResponse({ object: 'list', data, has_more: false, total_cards: data.length });
const urlOf = (i: number) => new URL(String(fetchMock.mock.calls[i]?.[0]));

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('search', () => {
  it('builds queries from text and filters', () => {
    expect(buildQuery(' dragon ', ['r', 'g'], 'modern')).toBe('dragon c>=rg f:modern');
    expect(buildQuery('', [], '')).toBe('');
  });

  it('searches Scryfall and shows results', async () => {
    fetchMock.mockResolvedValue(list([bolt(), anthem()]));
    renderApp('/');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search cards' }), 'bolt');
    await userEvent.click(screen.getByRole('button', { name: 'Color R' }));
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByRole('img', { name: 'Lightning Bolt' })).toBeInTheDocument();
    expect(screen.getByText('2 cards')).toBeInTheDocument();
    expect(urlOf(0).searchParams.get('q')).toBe('bolt c>=r');
  });

  it('shows an empty state when nothing matches', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ object: 'error', details: 'none' }, 404));
    renderApp('/?q=zzzz');
    expect(await screen.findByText('No cards found.')).toBeInTheDocument();
  });
});

describe('decks', () => {
  it('creates a deck, saves it and makes it active', async () => {
    renderApp('/decks');
    await userEvent.type(screen.getByRole('textbox', { name: 'Deck name' }), 'Burn');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Deck format' }), 'modern');
    await userEvent.click(screen.getByRole('button', { name: 'Create deck' }));
    expect(await screen.findByDisplayValue('Burn')).toBeInTheDocument();
    expect(screen.getByText(/Building:/)).toHaveTextContent('Burn');
    await waitFor(() => expect(loadDecks()[0]).toMatchObject({ name: 'Burn', format: 'modern' }));
  });

  it('imports a pasted decklist via Scryfall', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [bolt(), tokenMaker()], not_found: [{ name: 'Fake Card' }] }));
    renderApp('/decks');
    await userEvent.click(screen.getByRole('button', { name: 'Import list' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Decklist' }), '4 Lightning Bolt{enter}2 Raise the Alarm{enter}1 Fake Card');
    await userEvent.click(screen.getByRole('button', { name: 'Create deck' }));
    await waitFor(() => expect(loadDecks()[0]?.entries.map((e) => [e.card.name, e.qty])).toEqual([['Lightning Bolt', 4], ['Raise the Alarm', 2]]));
    expect(urlOf(0).pathname).toBe('/cards/collection');
  });

  it('adds a card from the card page to the active deck', async () => {
    const deck = newDeck('Tokens', 'modern');
    saveDecks([addCard(deck, tokenMaker(), 'main', 4)]);
    localStorage.setItem('magic-ranked:decks:v1:active', deck.id);
    const a = anthem();
    fetchMock.mockResolvedValue(jsonResponse(a));
    renderApp(`/card/${a.id}`);
    await userEvent.click(await screen.findByRole('button', { name: '+ Deck' }));
    expect(screen.getByRole('status')).toHaveTextContent('Added to deck');
    expect(screen.getByText(/Synergizes with 1 card/)).toBeInTheDocument();
    await waitFor(() => expect(loadDecks()[0]?.entries.find((e) => e.card.name === 'Glorious Anthem')?.qty).toBe(1));
  });

  it('shows stats and synergy tabs for a deck', async () => {
    let deck = newDeck('Tokens', 'modern');
    deck = addCard(deck, tokenMaker(), 'main', 4);
    deck = addCard(deck, anthem(), 'main', 4);
    saveDecks([deck]);
    renderApp(`/deck/${deck.id}`);
    await userEvent.click(screen.getByRole('tab', { name: 'Stats' }));
    expect(screen.getByText(/Main deck needs at least 60/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Synergy' }));
    expect(screen.getByText('Tokens / Go wide')).toBeInTheDocument();
    expect(screen.getByText('Synergy score (0–100)')).toBeInTheDocument();
  });

  it('suggests on-theme cards in the deck colors and format', () => {
    let deck = newDeck('Tokens', 'commander');
    deck = addCard(deck, card({ name: 'Boss', color_identity: ['W', 'G'] }), 'commander');
    deck = addCard(deck, tokenMaker());
    deck = addCard(deck, anthem());
    const q = suggestionQuery(deck, analyzeSynergy(deck.entries).themes[0]);
    expect(q).toContain('id<=wg');
    expect(q).toContain('f:commander');
    expect(q).toContain('-!"Glorious Anthem"');
  });
});

describe('upcoming', () => {
  it('lists announced sets and previewed cards', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-31T12:00:00Z'));
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/sets')) {
        return Promise.resolve(jsonResponse({ data: [
          { object: 'set', id: '1', code: 'nxt', name: 'Next Set', set_type: 'expansion', released_at: '2026-11-14', card_count: 120, icon_svg_uri: 'https://svgs.scryfall.io/sets/nxt.svg', digital: false },
          { object: 'set', id: '2', code: 'old', name: 'Old Set', set_type: 'expansion', released_at: '2019-01-01', card_count: 250, icon_svg_uri: '', digital: false },
        ] }));
      }
      return Promise.resolve(list([card({ name: 'Spoiled Dragon', released_at: '2026-11-14' })]));
    });
    renderApp('/upcoming');
    expect(await screen.findByText('Next Set')).toBeInTheDocument();
    expect(screen.getByText('in 14d')).toBeInTheDocument();
    expect(screen.queryByText('Old Set')).not.toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Spoiled Dragon' })).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe('rankings', () => {
  it('shows popular commanders ranked by EDHREC via Scryfall', async () => {
    fetchMock.mockResolvedValue(list([card({ name: 'Top Commander' }), card({ name: 'Second' })]));
    renderApp('/rankings');
    const first = await screen.findByRole('link', { name: 'Top Commander' });
    expect(within(first).getByText('#1')).toBeInTheDocument();
    expect(urlOf(0).searchParams.get('order')).toBe('edhrec');
    expect(urlOf(0).searchParams.get('q')).toBe(RANKING_QUERIES.commanders(''));
  });

  it('ranks my decks by score', async () => {
    let good = newDeck('Synergy deck', 'modern');
    good = addCard(good, tokenMaker(), 'main', 4);
    good = addCard(good, anthem(), 'main', 4);
    const empty = newDeck('Empty deck', 'modern');
    saveDecks([empty, good]);
    fetchMock.mockResolvedValue(list([]));
    renderApp('/rankings');
    await userEvent.click(screen.getByRole('tab', { name: 'My decks' }));
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Synergy deck');
    expect(items[1]).toHaveTextContent('Empty deck');
  });
});

describe('storage', () => {
  it('survives corrupt data', () => {
    localStorage.setItem('magic-ranked:decks:v1', '{not json');
    expect(loadDecks()).toEqual([]);
  });
});
