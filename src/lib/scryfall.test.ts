import { API, cardImage, getCollection, recentSets, searchCards, upcomingSets, ScryfallError } from './scryfall';
import type { ScryfallSet } from './types';
import { card, jsonResponse } from '../test/fixtures';

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe('searchCards', () => {
  it('calls the Scryfall search endpoint with encoded params', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ object: 'list', data: [card({ name: 'Bolt' })], has_more: false, total_cards: 1 }));
    const res = await searchCards('t:dragon c:r', { order: 'edhrec' });
    expect(res.data[0]?.name).toBe('Bolt');
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.origin + url.pathname).toBe(`${API}/cards/search`);
    expect(url.searchParams.get('q')).toBe('t:dragon c:r');
    expect(url.searchParams.get('order')).toBe('edhrec');
  });

  it('treats 404 (no matches) as an empty list', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ object: 'error', status: 404, details: 'No cards found' }, 404));
    await expect(searchCards('nothing')).resolves.toMatchObject({ data: [], total_cards: 0 });
  });

  it('surfaces Scryfall error details', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ object: 'error', status: 400, details: 'Bad syntax' }, 400));
    await expect(searchCards('((')).rejects.toEqual(new ScryfallError('Bad syntax', 400));
  });

  it('spaces out requests to respect the rate limit', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ object: 'list', data: [], has_more: false })));
    const start = Date.now();
    await Promise.all([searchCards('a'), searchCards('b'), searchCards('c')]);
    expect(Date.now() - start).toBeGreaterThanOrEqual(190);
  });
});

describe('getCollection', () => {
  it('batches names in chunks of 75', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ data: [card({ name: 'X' })], not_found: [{ name: 'Missing' }] })));
    const names = Array.from({ length: 80 }, (_, i) => `Card ${i}`);
    const res = await getCollection(names);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { identifiers: unknown[] };
    expect(body.identifiers).toHaveLength(75);
    expect(res.found).toHaveLength(2);
    expect(res.notFound).toEqual(['Missing', 'Missing']);
  });
});

describe('set helpers', () => {
  const set = (code: string, released_at: string, set_type = 'expansion'): ScryfallSet => ({ object: 'set', id: code, code, name: code, set_type, released_at, card_count: 1, icon_svg_uri: '', digital: false });
  const sets = [set('old', '2020-01-01'), set('rec', '2026-10-10'), set('nxt', '2026-11-14'), set('far', '2027-02-01'), set('tok', '2026-12-01', 'token')];

  it('lists upcoming playable sets soonest first', () => {
    expect(upcomingSets(sets, '2026-10-31').map((s) => s.code)).toEqual(['nxt', 'far']);
  });
  it('lists recent sets newest first', () => {
    expect(recentSets(sets, '2026-10-31').map((s) => s.code)).toEqual(['rec']);
  });
});

describe('cardImage', () => {
  it('falls back to the first face image', () => {
    const c = card({ name: 'DFC' });
    delete c.image_uris;
    c.card_faces = [{ name: 'Front', image_uris: { normal: 'front.jpg' } }, { name: 'Back', image_uris: { normal: 'back.jpg' } }];
    expect(cardImage(c)).toBe('front.jpg');
  });
});
