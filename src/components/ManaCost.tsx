const COLORS: Record<string, string> = {
  W: 'bg-amber-100 text-slate-900',
  U: 'bg-sky-500 text-white',
  B: 'bg-zinc-700 text-white',
  R: 'bg-red-600 text-white',
  G: 'bg-green-600 text-white',
  C: 'bg-slate-400 text-slate-900',
};

export function ManaCost({ cost }: { cost: string | undefined }) {
  if (cost === undefined || cost === '') return null;
  const symbols = cost.match(/\{[^}]+\}/g) ?? [];
  return (
    <span className="inline-flex flex-wrap gap-0.5" aria-label={`Mana cost ${cost}`}>
      {symbols.map((s, i) => {
        const inner = s.slice(1, -1);
        const key = inner.replace(/\/P$/, '').split('/')[0] ?? inner;
        return (
          <span key={i} className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${COLORS[key] ?? 'bg-slate-300 text-slate-900'}`}>
            {inner}
          </span>
        );
      })}
    </span>
  );
}
