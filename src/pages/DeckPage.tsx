import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDecks } from '../lib/storage';
import { count, deckScore, deckStats, exportDeck, FORMATS, moveCard, primaryType, setQty, validateDeck } from '../lib/deck';
import { analyzeSynergy, type ThemeResult } from '../lib/synergy';
import { searchCards } from '../lib/scryfall';
import { useAsync } from '../lib/useAsync';
import type { Board, Deck, DeckEntry, Format } from '../lib/types';
import { ManaCost } from '../components/ManaCost';
import { CardGrid } from '../components/CardGrid';
import { Bar, Button, Empty, ErrorBox, Section, Spinner, Tabs } from '../components/ui';

type Tab = 'cards' | 'stats' | 'synergy' | 'suggest';

export function DeckPage() {
  const { id = '' } = useParams();
  const { decks } = useDecks();
  const deck = decks.find((d) => d.id === id);
  if (deck === undefined) return <Empty>Deck not found. <Link className="text-brand underline" to="/decks">Back to decks</Link></Empty>;
  return <DeckEditor deck={deck} />;
}

export function DeckEditor({ deck }: { deck: Deck }) {
  const { upsert, remove, setActiveId, activeId } = useDecks();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('cards');
  const [copied, setCopied] = useState(false);
  const score = useMemo(() => deckScore(deck), [deck]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(exportDeck(deck)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  return (
    <div>
      <div className="mb-3 space-y-2">
        <input
          value={deck.name}
          onChange={(e) => upsert({ ...deck, name: e.target.value, updatedAt: Date.now() })}
          aria-label="Deck name"
          className="w-full bg-transparent text-xl font-bold outline-none"
        />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select value={deck.format} onChange={(e) => upsert({ ...deck, format: e.target.value as Format, updatedAt: Date.now() })} aria-label="Deck format" className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1">
            {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <span className="text-slate-400">{count(deck.entries, 'main') + count(deck.entries, 'commander')} main · {count(deck.entries, 'side')} side</span>
          <span className="ml-auto rounded-full bg-slate-800 px-3 py-1">Score <b className="text-brand">{score.score}</b></span>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeId !== deck.id ? <Button onClick={() => setActiveId(deck.id)}>Make active</Button> : <Button onClick={() => nav('/')}>+ Add cards</Button>}
          <Button variant="ghost" onClick={() => void copy()}>{copied ? 'Copied!' : 'Export list'}</Button>
          <Button variant="danger" onClick={() => { if (confirm(`Delete “${deck.name}”?`)) { remove(deck.id); nav('/decks'); } }}>Delete</Button>
        </div>
      </div>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'cards', label: 'Cards' }, { id: 'stats', label: 'Stats' }, { id: 'synergy', label: 'Synergy' }, { id: 'suggest', label: 'Ideas' }]} />
      {tab === 'cards' && <CardList deck={deck} />}
      {tab === 'stats' && <Stats deck={deck} />}
      {tab === 'synergy' && <Synergy deck={deck} />}
      {tab === 'suggest' && <Suggestions deck={deck} />}
    </div>
  );
}

function CardList({ deck }: { deck: Deck }) {
  const { upsert } = useDecks();
  if (deck.entries.length === 0) return <Empty>Empty deck. Tap <b>+ Add cards</b> and search for cards to add.</Empty>;
  const groups = new Map<string, DeckEntry[]>();
  for (const e of deck.entries) {
    const key = e.board === 'commander' ? 'Commander' : e.board === 'side' ? 'Sideboard' : primaryType(e.card);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const order = ['Commander', 'Creature', 'Planeswalker', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Battle', 'Other', 'Land', 'Sideboard'];
  const change = (e: DeckEntry, d: number) => upsert(setQty(deck, e.card.name, e.board, e.qty + d));
  const move = (e: DeckEntry, to: Board) => upsert(moveCard(deck, e.card.name, e.board, to));
  return (
    <div>
      {order.filter((k) => groups.has(k)).map((k) => {
        const list = [...groups.get(k)!].sort((a, b) => a.card.cmc - b.card.cmc || a.card.name.localeCompare(b.card.name));
        return (
          <Section key={k} title={`${k} (${list.reduce((n, e) => n + e.qty, 0)})`}>
            <ul className="divide-y divide-slate-800 rounded-lg bg-slate-900">
              {list.map((e) => (
                <li key={`${e.board}-${e.card.name}`} className="flex items-center gap-2 px-3 py-2">
                  <span className="w-6 text-right font-semibold tabular-nums">{e.qty}</span>
                  <Link to={`/card/${e.card.id}`} className="min-w-0 flex-1 truncate">{e.card.name}</Link>
                  <ManaCost cost={e.card.mana_cost} />
                  <div className="flex gap-1">
                    <button aria-label={`Remove one ${e.card.name}`} onClick={() => change(e, -1)} className="h-7 w-7 rounded bg-slate-800">−</button>
                    <button aria-label={`Add one ${e.card.name}`} onClick={() => change(e, 1)} className="h-7 w-7 rounded bg-slate-800">+</button>
                    <button aria-label={`Move ${e.card.name}`} onClick={() => move(e, e.board === 'side' ? 'main' : 'side')} className="h-7 rounded bg-slate-800 px-2 text-xs">{e.board === 'side' ? 'Main' : 'Side'}</button>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        );
      })}
    </div>
  );
}

function Stats({ deck }: { deck: Deck }) {
  const s = useMemo(() => deckStats(deck.entries), [deck]);
  const issues = useMemo(() => validateDeck(deck), [deck]);
  const maxCurve = Math.max(...s.curve, 1);
  const colorNames = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' } as const;
  const colorCls = { W: 'bg-amber-100', U: 'bg-sky-500', B: 'bg-zinc-500', R: 'bg-red-600', G: 'bg-green-600', C: 'bg-slate-400' } as const;
  const maxPip = Math.max(...Object.values(s.colors), 1);
  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Cards" value={String(s.total)} />
        <Stat label="Avg mana value" value={s.avgCmc.toFixed(2)} />
        <Stat label="Est. price" value={`$${s.priceUsd.toFixed(0)}`} />
      </div>
      <Section title="Deck health">
        {issues.length === 0 ? <p className="text-sm text-green-400">Looks good — no problems found.</p> : (
          <ul className="space-y-1 text-sm">
            {issues.map((i, n) => <li key={n} className={i.level === 'error' ? 'text-red-300' : 'text-amber-300'}>{i.level === 'error' ? '✕' : '!'} {i.message}</li>)}
          </ul>
        )}
      </Section>
      <Section title="Mana curve">
        <div className="flex h-32 items-end gap-1" aria-label="Mana curve chart">
          {s.curve.map((n, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs tabular-nums text-slate-400">{n || ''}</span>
              <div className="w-full rounded-t bg-brand" style={{ height: `${(n / maxCurve) * 90}px` }} />
              <span className="text-xs">{i === 7 ? '7+' : i}</span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Roles">
        <div className="space-y-1">
          <Bar label="Ramp" value={s.roles.ramp} max={Math.max(15, s.roles.ramp)} />
          <Bar label="Card draw" value={s.roles.draw} max={Math.max(15, s.roles.draw)} />
          <Bar label="Removal" value={s.roles.removal} max={Math.max(15, s.roles.removal)} />
          <Bar label="Board wipes" value={s.roles.wipes} max={Math.max(15, s.roles.wipes)} />
        </div>
      </Section>
      <Section title="Color pips">
        <div className="space-y-1">
          {(Object.keys(s.colors) as (keyof typeof s.colors)[]).filter((k) => s.colors[k] > 0).map((k) => <Bar key={k} label={colorNames[k]} value={s.colors[k]} max={maxPip} color={colorCls[k]} />)}
        </div>
      </Section>
      <Section title="Card types">
        <div className="space-y-1">
          {Object.entries(s.types).sort((a, b) => b[1] - a[1]).map(([t, n]) => <Bar key={t} label={t} value={n} max={s.total} />)}
        </div>
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-900 p-2">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  );
}

function Synergy({ deck }: { deck: Deck }) {
  const r = useMemo(() => analyzeSynergy(deck.entries), [deck]);
  if (r.themes.length === 0 && r.tribal.length === 0) return <Empty>Add more cards to detect synergies.</Empty>;
  return (
    <div>
      <div className="mb-4 rounded-lg bg-slate-900 p-3 text-center">
        <p className="text-4xl font-extrabold text-brand">{r.score}</p>
        <p className="text-xs text-slate-400">Synergy score (0–100)</p>
      </div>
      {r.tribal.map((t) => (
        <div key={t.type} className="mb-3 rounded-lg bg-slate-900 p-3">
          <p className="font-semibold">{t.type} tribal <span className="text-sm text-slate-400">· {t.count} {t.type}s</span></p>
          {t.payoffs.length > 0 && <p className="mt-1 text-xs text-slate-300">Payoffs: {t.payoffs.join(', ')}</p>}
        </div>
      ))}
      {r.themes.map((t) => <ThemeCard key={t.theme.id} t={t} />)}
    </div>
  );
}

function ThemeCard({ t }: { t: ThemeResult }) {
  return (
    <details className="mb-2 rounded-lg bg-slate-900 p-3">
      <summary className="flex cursor-pointer items-center gap-2">
        <span className="flex-1 font-semibold">{t.theme.name}</span>
        <span className="text-xs text-slate-400">{t.enablers.length} enablers · {t.payoffs.length} payoffs</span>
        <span className="w-10 text-right font-bold text-brand">{t.score}</span>
      </summary>
      <p className="mt-2 text-xs text-slate-400">{t.theme.description}</p>
      {t.enablers.length > 0 && <p className="mt-2 text-xs"><b>Enablers:</b> {t.enablers.join(', ')}</p>}
      {t.payoffs.length > 0 && <p className="mt-1 text-xs"><b>Payoffs:</b> {t.payoffs.join(', ')}</p>}
      {t.payoffs.length === 0 && <p className="mt-1 text-xs text-amber-300">No payoffs yet — check the Ideas tab.</p>}
      {t.enablers.length === 0 && <p className="mt-1 text-xs text-amber-300">No enablers yet.</p>}
    </details>
  );
}

/** Build a Scryfall query for cards that fit the deck's best theme. */
export function suggestionQuery(deck: Deck, theme: ThemeResult | undefined): string | undefined {
  if (theme === undefined) return undefined;
  const commanders = deck.entries.filter((e) => e.board === 'commander');
  const identity = [...new Set((commanders.length ? commanders : deck.entries).flatMap((e) => e.card.color_identity))].join('').toLowerCase() || 'c';
  const exclude = deck.entries.slice(0, 40).map((e) => `-!"${e.card.name.replace(/"/g, '')}"`).join(' ');
  return `${theme.theme.suggestQuery} id<=${identity} f:${deck.format} -t:basic ${exclude}`.trim();
}

function Suggestions({ deck }: { deck: Deck }) {
  const r = useMemo(() => analyzeSynergy(deck.entries), [deck]);
  const [pick, setPick] = useState(0);
  const candidates = r.themes.slice(0, 4);
  const theme = candidates[pick];
  const q = suggestionQuery(deck, theme);
  const res = useAsync(() => (q === undefined ? Promise.resolve(undefined) : searchCards(q, { order: 'edhrec' })), [q]);
  if (theme === undefined) return <Empty>Add some cards first — suggestions are based on your deck's themes.</Empty>;
  return (
    <div>
      <p className="mb-2 text-sm text-slate-300">Popular cards that support your themes and fit your colors and format:</p>
      <div className="mb-3 flex flex-wrap gap-1">
        {candidates.map((t, i) => (
          <button key={t.theme.id} onClick={() => setPick(i)} aria-pressed={pick === i} className={`rounded-full px-3 py-1 text-xs ${pick === i ? 'bg-brand text-slate-950' : 'bg-slate-800'}`}>{t.theme.name}</button>
        ))}
      </div>
      {res.loading && <Spinner />}
      {res.error !== undefined && <ErrorBox>{res.error}</ErrorBox>}
      {res.data && res.data.data.length === 0 && <Empty>No suggestions found.</Empty>}
      {res.data && <CardGrid cards={res.data.data.slice(0, 18)} />}
    </div>
  );
}
