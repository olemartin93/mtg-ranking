import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useDecks } from '../lib/storage';

const NAV = [
  { to: '/', label: 'Search', icon: 'M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z' },
  { to: '/upcoming', label: 'Upcoming', icon: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
  { to: '/decks', label: 'Decks', icon: 'M4 6h12v14H4zM8 2h12v14' },
  { to: '/rankings', label: 'Rankings', icon: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3' },
];

export function Layout() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const { decks, activeId } = useDecks();
  const active = decks.find((d) => d.id === activeId);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold tracking-tight">
            Magic<span className="text-brand">:</span> ranked
          </h1>
          {active !== undefined && (
            <NavLink to={`/deck/${active.id}`} className="max-w-[50%] truncate rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
              Building: <span className="font-semibold text-brand">{active.name}</span>
            </NavLink>
          )}
        </div>
        {!online && <p className="mt-1 text-xs text-amber-300">Offline — showing saved decks and cached cards.</p>}
      </header>
      <main className="flex-1 px-4 py-4">
        <Outlet />
      </main>
      <footer className="px-4 pb-4 text-center text-[11px] leading-snug text-slate-500">
        Card data and images from <a className="underline" href="https://scryfall.com" target="_blank" rel="noreferrer">Scryfall</a>. Popularity from{' '}
        <a className="underline" href="https://edhrec.com" target="_blank" rel="noreferrer">EDHREC</a> via Scryfall. Magic: The Gathering is © Wizards of the Coast. Unofficial fan app.
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto grid max-w-3xl grid-cols-4">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-xs ${isActive ? 'text-brand' : 'text-slate-400'}`}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={n.icon} />
                </svg>
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
