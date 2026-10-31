import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Deck } from './types';

const KEY = 'magic-ranked:decks:v1';

export function loadDecks(storage: Storage = localStorage): Deck[] {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Deck[]) : [];
  } catch {
    return [];
  }
}

export function saveDecks(decks: Deck[], storage: Storage = localStorage): void {
  try {
    storage.setItem(KEY, JSON.stringify(decks));
  } catch {
    // Storage full or blocked: keep working in memory.
  }
}

interface DeckStore {
  decks: Deck[];
  upsert: (deck: Deck) => void;
  remove: (id: string) => void;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
}

const Ctx = createContext<DeckStore | null>(null);

export function DeckProvider({ children }: { children: ReactNode }) {
  const [decks, setDecks] = useState<Deck[]>(() => loadDecks());
  const [activeId, setActiveId] = useState<string | null>(() => {
    try { return localStorage.getItem(`${KEY}:active`); } catch { return null; }
  });

  useEffect(() => saveDecks(decks), [decks]);
  useEffect(() => {
    try {
      if (activeId === null) localStorage.removeItem(`${KEY}:active`);
      else localStorage.setItem(`${KEY}:active`, activeId);
    } catch { /* ignore */ }
  }, [activeId]);

  const upsert = useCallback((deck: Deck) => {
    setDecks((ds) => (ds.some((d) => d.id === deck.id) ? ds.map((d) => (d.id === deck.id ? deck : d)) : [...ds, deck]));
  }, []);
  const remove = useCallback((id: string) => {
    setDecks((ds) => ds.filter((d) => d.id !== id));
    setActiveId((a) => (a === id ? null : a));
  }, []);

  const value = useMemo(() => ({ decks, upsert, remove, activeId, setActiveId }), [decks, upsert, remove, activeId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDecks(): DeckStore {
  const v = useContext(Ctx);
  if (v === null) throw new Error('useDecks must be used inside DeckProvider');
  return v;
}
