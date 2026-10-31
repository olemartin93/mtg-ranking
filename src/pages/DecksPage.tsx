import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDecks } from '../lib/storage';
import { addCard, count, deckScore, FORMATS, formatInfo, newDeck, parseDecklist } from '../lib/deck';
import { getCollection } from '../lib/scryfall';
import type { Format } from '../lib/types';
import { Button, Empty, ErrorBox, Section } from '../components/ui';

export function DecksPage() {
  const { decks, upsert, setActiveId, activeId } = useDecks();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [format, setFormat] = useState<Format>('commander');
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const create = async (e: FormEvent) => {
    e.preventDefault();
    let deck = newDeck(name.trim() || 'Untitled deck', format);
    if (showImport && importText.trim()) {
      const lines = parseDecklist(importText);
      if (lines.length === 0) { setError('No cards found in the decklist.'); return; }
      setBusy(true);
      setError(undefined);
      try {
        const { found, notFound } = await getCollection([...new Set(lines.map((l) => l.name))]);
        const byName = new Map(found.map((c) => [c.name.toLowerCase(), c]));
        for (const c of found) { const front = c.name.split(' // ')[0]; if (front) byName.set(front.toLowerCase(), c); }
        for (const l of lines) {
          const card = byName.get(l.name.toLowerCase());
          if (card) deck = addCard(deck, card, l.board, l.qty);
        }
        if (notFound.length) setError(`Couldn't find: ${notFound.join(', ')}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import failed');
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    upsert(deck);
    setActiveId(deck.id);
    nav(`/deck/${deck.id}`);
  };

  const sorted = [...decks].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div>
      <Section title="New deck">
        <form onSubmit={(e) => void create(e)} className="space-y-2 rounded-lg bg-slate-900 p-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Deck name" aria-label="Deck name" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" />
          <div className="flex gap-2">
            <select value={format} onChange={(e) => setFormat(e.target.value as Format)} aria-label="Deck format" className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2">
              {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <Button type="button" variant="ghost" onClick={() => setShowImport((s) => !s)}>{showImport ? 'No import' : 'Import list'}</Button>
          </div>
          {showImport && (
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={8}
              aria-label="Decklist"
              placeholder={'Paste a decklist (Arena / MTGO format)\n\nCommander\n1 Atraxa, Praetors\' Voice\n\nDeck\n1 Sol Ring\n...'}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
            />
          )}
          <Button type="submit" disabled={busy} className="w-full">{busy ? 'Importing…' : 'Create deck'}</Button>
          {error !== undefined && <ErrorBox>{error}</ErrorBox>}
        </form>
      </Section>

      <Section title="Your decks">
        {sorted.length === 0 && <Empty>No decks yet. Decks are saved on this device and work offline.</Empty>}
        <ul className="space-y-2">
          {sorted.map((d) => (
            <li key={d.id}>
              <Link to={`/deck/${d.id}`} onClick={() => setActiveId(d.id)} className="flex items-center gap-3 rounded-lg bg-slate-900 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{d.name} {d.id === activeId && <span className="ml-1 rounded bg-brand px-1.5 text-[10px] text-slate-950">ACTIVE</span>}</p>
                  <p className="text-xs text-slate-400">{formatInfo(d.format).name} · {count(d.entries)} cards</p>
                </div>
                <span className="text-sm text-slate-400">Score <span className="font-bold text-slate-100">{deckScore(d).score}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
