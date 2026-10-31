import { Link } from 'react-router-dom';
import { getSets, recentSets, searchCards, today, upcomingSets } from '../lib/scryfall';
import { useAsync } from '../lib/useAsync';
import type { ScryfallSet } from '../lib/types';
import { CardGrid } from '../components/CardGrid';
import { Empty, ErrorBox, Section, Spinner } from '../components/ui';

export function daysUntil(date: string, from: string): number {
  return Math.round((new Date(date).getTime() - new Date(from).getTime()) / 86_400_000);
}

function SetRow({ set, now }: { set: ScryfallSet; now: string }) {
  const d = set.released_at !== undefined ? daysUntil(set.released_at, now) : 0;
  return (
    <li>
      <Link to={`/?q=${encodeURIComponent(`e:${set.code}`)}&order=released`} className="flex items-center gap-3 rounded-lg bg-slate-900 p-3 active:bg-slate-800">
        <img src={set.icon_svg_uri} alt="" className="h-8 w-8 invert" loading="lazy" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{set.name}</p>
          <p className="text-xs text-slate-400">{set.released_at} · {set.card_count > 0 ? `${set.card_count} cards revealed` : 'no cards yet'}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${d > 0 ? 'bg-brand text-slate-950' : 'bg-slate-700'}`}>
          {d > 0 ? `in ${d}d` : d === 0 ? 'today' : `${-d}d ago`}
        </span>
      </Link>
    </li>
  );
}

export function UpcomingPage() {
  const now = today();
  const sets = useAsync(() => getSets(), []);
  const previews = useAsync(() => searchCards(`date>${now} -is:digital`, { order: 'released', dir: 'asc', unique: 'cards' }), [now]);

  const upcoming = sets.data ? upcomingSets(sets.data, now) : [];
  const recent = sets.data ? recentSets(sets.data, now) : [];

  return (
    <div>
      <Section title="Upcoming sets">
        {sets.loading && <Spinner />}
        {sets.error !== undefined && <ErrorBox>{sets.error}</ErrorBox>}
        {sets.data && upcoming.length === 0 && <Empty>No announced sets right now.</Empty>}
        <ul className="space-y-2">{upcoming.map((s) => <SetRow key={s.id} set={s} now={now} />)}</ul>
      </Section>

      <Section title="Previewed cards" action={<Link className="text-sm text-brand" to={`/?q=${encodeURIComponent(`date>${now}`)}&order=released`}>See all</Link>}>
        {previews.loading && <Spinner />}
        {previews.error !== undefined && <ErrorBox>{previews.error}</ErrorBox>}
        {previews.data && previews.data.data.length === 0 && <Empty>No unreleased cards revealed yet.</Empty>}
        {previews.data && <CardGrid cards={previews.data.data.slice(0, 24)} />}
      </Section>

      <Section title="Recently released">
        <ul className="space-y-2">{recent.map((s) => <SetRow key={s.id} set={s} now={now} />)}</ul>
      </Section>
    </div>
  );
}
