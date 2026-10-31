import { Link } from 'react-router-dom';
import type { ScryfallCard } from '../lib/types';
import { cardImage } from '../lib/scryfall';

export function CardTile({ card, badge }: { card: ScryfallCard; badge?: string }) {
  const img = cardImage(card, 'normal');
  return (
    <Link to={`/card/${card.id}`} className="group relative block overflow-hidden rounded-[4.5%] bg-slate-800 shadow" aria-label={card.name}>
      {img !== undefined ? (
        <img src={img} alt={card.name} loading="lazy" className="aspect-[488/680] w-full object-cover transition group-active:scale-95" />
      ) : (
        <div className="flex aspect-[488/680] items-center justify-center p-2 text-center text-xs">{card.name}</div>
      )}
      {badge !== undefined && (
        <span className="absolute left-1 top-1 rounded bg-slate-950/85 px-1.5 py-0.5 text-xs font-bold text-brand">{badge}</span>
      )}
    </Link>
  );
}

export function CardGrid({ cards, badge }: { cards: ScryfallCard[]; badge?: (c: ScryfallCard, i: number) => string }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {cards.map((c, i) => (badge ? <CardTile key={c.id} card={c} badge={badge(c, i)} /> : <CardTile key={c.id} card={c} />))}
    </div>
  );
}
