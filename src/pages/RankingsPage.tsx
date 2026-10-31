import { useState } from 'react';
import { Link } from 'react-router-dom';
import { searchCards } from '../lib/scryfall';
import { useAsync } from '../lib/useAsync';
import { useDecks } from '../lib/storage';
import { deckScore, formatInfo } from '../lib/deck';
import { CardGrid } from '../components/CardGrid';
import { Empty, ErrorBox, Spinner, Tabs } from '../components/ui';

type Tab = 'commanders' | 'staples' | 'new' | 'mine';

const COLOR_FILTERS = [
  { id: '', label: 'All' }, { id: 'w', label: 'White' }, { id: 'u', label: 'Blue' }, { id: 'b', label: 'Black' },
  { id: 'r', label: 'Red' }, { id: 'g', label: 'Green' }, { id: 'c', label: 'Colorless' },
];

export const RANKING_QUERIES: Record<Exclude<Tab, 'mine'>, (color: string) => string> = {
  commanders: (c) => `is:commander game:paper${c ? ` id=${c}` : ''}`,
  staples: (c) => `-t:basic game:paper f:commander${c ? ` c=${c}` : ''}`,
  new: (c) => `year>=${new Date().getFullYear() - 1} game:paper -t:basic is:firstprint${c ? ` c=${c}` : ''}`,
};

function PopularList({ tab, color }: { tab: Exclude<Tab, 'mine'>; color: string }) {
  const q = RANKING_QUERIES[tab](color);
  const { data, error, loading } = useAsync(() => searchCards(q, { order: 'edhrec' }), [q]);
  if (loading) return <Spinner />;
  if (error !== undefined) return <ErrorBox>{error}</ErrorBox>;
  if (!data || data.data.length === 0) return <Empty>Nothing ranked yet.</Empty>;
  return <CardGrid cards={data.data.slice(0, 60)} badge={(_c, i) => `#${i + 1}`} />;
}

function MyDecks() {
  const { decks } = useDecks();
  if (decks.length === 0) return <Empty>Build a deck to see it ranked here.</Empty>;
  const ranked = decks.map((d) => ({ d, s: deckScore(d) })).sort((a, b) => b.s.score - a.s.score);
  return (
    <ol className="space-y-2">
      {ranked.map(({ d, s }, i) => (
        <li key={d.id}>
          <Link to={`/deck/${d.id}`} className="flex items-center gap-3 rounded-lg bg-slate-900 p-3">
            <span className="w-8 text-center text-lg font-extrabold text-brand">#{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{d.name}</p>
              <p className="text-xs text-slate-400">{formatInfo(d.format).name} · synergy {s.synergy} · curve {s.curve} · {s.legal ? 'legal' : 'not legal yet'}</p>
            </div>
            <span className="text-2xl font-bold tabular-nums">{s.score}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function RankingsPage() {
  const [tab, setTab] = useState<Tab>('commanders');
  const [color, setColor] = useState('');
  return (
    <div>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[{ id: 'commanders', label: 'Commanders' }, { id: 'staples', label: 'Staples' }, { id: 'new', label: 'New hits' }, { id: 'mine', label: 'My decks' }]}
      />
      {tab !== 'mine' && (
        <>
          <p className="mb-2 text-xs text-slate-400">
            Ranked by how many decks on <a className="underline" href="https://edhrec.com" target="_blank" rel="noreferrer">EDHREC</a> play each card (data via Scryfall).
          </p>
          <div className="mb-3 flex gap-1 overflow-x-auto">
            {COLOR_FILTERS.map((c) => (
              <button key={c.id} onClick={() => setColor(c.id)} aria-pressed={color === c.id} className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${color === c.id ? 'bg-brand text-slate-950' : 'bg-slate-800'}`}>
                {c.label}
              </button>
            ))}
          </div>
          <PopularList tab={tab} color={color} />
        </>
      )}
      {tab === 'mine' && (
        <>
          <p className="mb-3 text-xs text-slate-400">Score = 50% synergy + 30% mana curve + 20% legality, minus deck-health warnings.</p>
          <MyDecks />
        </>
      )}
    </div>
  );
}
