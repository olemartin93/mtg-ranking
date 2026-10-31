import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchCards, type SearchOptions } from '../lib/scryfall';
import type { ScryfallCard } from '../lib/types';
import { CardGrid } from '../components/CardGrid';
import { Button, Empty, ErrorBox, Spinner } from '../components/ui';
import { FORMATS } from '../lib/deck';

const COLORS = [
  { id: 'w', label: 'W', cls: 'bg-amber-100 text-slate-900' },
  { id: 'u', label: 'U', cls: 'bg-sky-500' },
  { id: 'b', label: 'B', cls: 'bg-zinc-700' },
  { id: 'r', label: 'R', cls: 'bg-red-600' },
  { id: 'g', label: 'G', cls: 'bg-green-600' },
  { id: 'c', label: 'C', cls: 'bg-slate-400 text-slate-900' },
];
const ORDERS: { id: NonNullable<SearchOptions['order']>; label: string }[] = [
  { id: 'edhrec', label: 'Popularity' },
  { id: 'name', label: 'Name' },
  { id: 'released', label: 'Newest' },
  { id: 'cmc', label: 'Mana value' },
  { id: 'usd', label: 'Price' },
];

/** Combine the free-text box with the filter chips into one Scryfall query. */
export function buildQuery(text: string, colors: string[], format: string): string {
  const parts = [text.trim()];
  if (colors.length) parts.push(`c>=${colors.join('')}`);
  if (format) parts.push(`f:${format}`);
  return parts.filter(Boolean).join(' ');
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const order = (params.get('order') ?? 'edhrec') as NonNullable<SearchOptions['order']>;
  const [text, setText] = useState(q);
  const [colors, setColors] = useState<string[]>([]);
  const [format, setFormat] = useState('');
  const [cards, setCards] = useState<ScryfallCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => setText(q), [q]);

  useEffect(() => {
    if (q === '') { setCards([]); setTotal(0); setHasMore(false); return; }
    let alive = true;
    setLoading(true);
    setError(undefined);
    searchCards(q, { order, page: 1 })
      .then((res) => {
        if (!alive) return;
        setCards(res.data); setTotal(res.total_cards ?? res.data.length); setHasMore(res.has_more); setPage(1);
      })
      .catch((e: unknown) => alive && setError(navigator.onLine ? (e instanceof Error ? e.message : 'Search failed') : "You're offline and this search isn't cached."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [q, order]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const query = buildQuery(text, colors, format);
    setParams(query ? { q: query, order } : {});
  };

  const loadMore = async () => {
    setLoading(true);
    try {
      const res = await searchCards(q, { order, page: page + 1 });
      setCards((c) => [...c, ...res.data]); setHasMore(res.has_more); setPage(page + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={submit} className="mb-3 space-y-2" role="search">
        <div className="flex gap-2">
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Card name or Scryfall syntax, e.g. t:dragon'
            aria-label="Search cards"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base outline-none focus:border-brand"
          />
          <Button type="submit">Search</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {COLORS.map((c) => {
            const on = colors.includes(c.id);
            return (
              <button
                type="button"
                key={c.id}
                aria-pressed={on}
                aria-label={`Color ${c.label}`}
                onClick={() => setColors((cs) => (on ? cs.filter((x) => x !== c.id) : [...cs, c.id]))}
                className={`h-8 w-8 rounded-full text-xs font-bold ${c.cls} ${on ? 'ring-2 ring-brand ring-offset-2 ring-offset-slate-950' : 'opacity-60'}`}
              >
                {c.label}
              </button>
            );
          })}
          <select value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Format" className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm">
            <option value="">Any format</option>
            {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select value={order} onChange={(e) => setParams({ q, order: e.target.value })} aria-label="Sort by" className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm">
            {ORDERS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </form>

      {error !== undefined && <ErrorBox>{error}</ErrorBox>}
      {q === '' && (
        <div className="space-y-2 text-sm text-slate-400">
          <p>Search every Magic card, including newly previewed ones.</p>
          <div className="flex flex-wrap gap-2">
            {['t:legendary t:creature', 'is:spoiler', 'o:"draw a card" c:u', 't:dragon', 'is:commander'].map((s) => (
              <button key={s} onClick={() => setParams({ q: s, order })} className="rounded-full bg-slate-800 px-3 py-1 text-slate-200">{s}</button>
            ))}
          </div>
        </div>
      )}
      {q !== '' && !loading && error === undefined && cards.length === 0 && <Empty>No cards found.</Empty>}
      {cards.length > 0 && <p className="mb-2 text-xs text-slate-400">{total.toLocaleString('en')} cards</p>}
      <CardGrid cards={cards} />
      {loading && <Spinner />}
      {hasMore && !loading && <Button variant="ghost" className="mt-4 w-full" onClick={() => void loadMore()}>Load more</Button>}
    </div>
  );
}
