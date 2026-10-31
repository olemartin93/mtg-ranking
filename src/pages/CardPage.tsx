import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { cardImage, cardText, getCard } from '../lib/scryfall';
import { useAsync } from '../lib/useAsync';
import { useDecks } from '../lib/storage';
import { addCard, FORMATS } from '../lib/deck';
import { pairSynergy, THEMES } from '../lib/synergy';
import type { Board, ScryfallCard } from '../lib/types';
import { ManaCost } from '../components/ManaCost';
import { Button, ErrorBox, Spinner } from '../components/ui';

const themeName = (id: string) => THEMES.find((t) => t.id === id)?.name ?? id;

export function CardPage() {
  const { id = '' } = useParams();
  const { data: card, error, loading } = useAsync(() => getCard(id), [id]);
  if (loading) return <Spinner />;
  if (error !== undefined || card === undefined) return <ErrorBox>{error ?? 'Card not found'}</ErrorBox>;
  return <CardDetail card={card} />;
}

export function CardDetail({ card }: { card: ScryfallCard }) {
  const { decks, activeId, upsert } = useDecks();
  const deck = decks.find((d) => d.id === activeId);
  const [flash, setFlash] = useState<string>();
  const [face, setFace] = useState(0);
  const faces = card.card_faces?.filter((f) => f.image_uris !== undefined) ?? [];
  const img = faces.length > 1 ? faces[face]?.image_uris?.normal : cardImage(card, 'normal');

  const add = (board: Board) => {
    if (deck === undefined) return;
    upsert(addCard(deck, card, board));
    setFlash(`Added to ${board === 'main' ? 'deck' : board} of “${deck.name}”`);
    setTimeout(() => setFlash(undefined), 2000);
  };

  const synergies = deck === undefined ? [] : deck.entries
    .filter((e) => e.card.name !== card.name)
    .map((e) => ({ name: e.card.name, themes: pairSynergy(card, e.card) }))
    .filter((s) => s.themes.length > 0);

  return (
    <article className="space-y-4">
      <div className="mx-auto w-full max-w-xs">
        {img !== undefined && <img src={img} alt={card.name} className="w-full rounded-[4.5%] shadow-lg" />}
        {faces.length > 1 && <Button variant="ghost" className="mt-2 w-full" onClick={() => setFace((f) => (f + 1) % faces.length)}>Flip card</Button>}
      </div>
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-xl font-bold">{card.name}</h2>
          <ManaCost cost={card.mana_cost ?? card.card_faces?.[0]?.mana_cost} />
        </div>
        <p className="text-sm text-slate-300">{card.type_line}</p>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{cardText(card)}</p>
        {card.power !== undefined && <p className="mt-1 text-sm font-semibold">{card.power}/{card.toughness}</p>}
        <p className="mt-2 text-xs text-slate-400">
          {card.set_name} · {card.rarity} · released {card.released_at}
          {card.edhrec_rank !== undefined && <> · EDHREC rank #{card.edhrec_rank.toLocaleString('en')}</>}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {card.prices?.usd ? `$${card.prices.usd}` : 'No USD price'}{card.prices?.eur ? ` · €${card.prices.eur}` : ''}
          {card.scryfall_uri !== undefined && <> · <a className="underline" href={card.scryfall_uri} target="_blank" rel="noreferrer">View on Scryfall</a></>}
        </p>
      </div>

      <div className="rounded-lg bg-slate-900 p-3">
        {deck === undefined ? (
          <p className="text-sm text-slate-300"><Link to="/decks" className="text-brand underline">Create or open a deck</Link> to add this card.</p>
        ) : (
          <>
            <p className="mb-2 text-sm">Add to <span className="font-semibold text-brand">{deck.name}</span></p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => add('main')}>+ Deck</Button>
              <Button variant="ghost" onClick={() => add('side')}>+ Sideboard</Button>
              {deck.format === 'commander' && <Button variant="ghost" onClick={() => add('commander')}>Set as commander</Button>}
            </div>
            {flash !== undefined && <p role="status" className="mt-2 text-xs text-green-400">{flash}</p>}
            {synergies.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-semibold">Synergizes with {synergies.length} card{synergies.length > 1 ? 's' : ''} in your deck</p>
                <ul className="mt-1 space-y-0.5 text-xs text-slate-300">
                  {synergies.slice(0, 8).map((s) => <li key={s.name}>{s.name} — {s.themes.map(themeName).join(', ')}</li>)}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold">Legality</h3>
        <ul className="grid grid-cols-2 gap-1 text-xs">
          {FORMATS.map((f) => {
            const l = card.legalities[f.id] ?? 'not_legal';
            const cls = l === 'legal' ? 'bg-green-800' : l === 'restricted' ? 'bg-sky-800' : l === 'banned' ? 'bg-red-800' : 'bg-slate-800 text-slate-400';
            return <li key={f.id} className={`flex justify-between rounded px-2 py-1 ${cls}`}><span>{f.name}</span><span>{l.replace('_', ' ')}</span></li>;
          })}
        </ul>
      </div>
    </article>
  );
}
