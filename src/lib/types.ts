/** Subset of the Scryfall card object (https://scryfall.com/docs/api/cards) that the app uses. */
export interface ScryfallImageUris {
  small?: string;
  normal?: string;
  large?: string;
  art_crop?: string;
}

export interface ScryfallCardFace {
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  image_uris?: ScryfallImageUris;
}

export type Legality = 'legal' | 'not_legal' | 'restricted' | 'banned';

export interface ScryfallCard {
  object: 'card';
  id: string;
  oracle_id?: string;
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity: string[];
  keywords?: string[];
  legalities: Record<string, Legality>;
  set: string;
  set_name: string;
  rarity: string;
  released_at: string;
  image_uris?: ScryfallImageUris;
  card_faces?: ScryfallCardFace[];
  prices?: { usd?: string | null; usd_foil?: string | null; eur?: string | null };
  edhrec_rank?: number;
  power?: string;
  toughness?: string;
  scryfall_uri?: string;
}

export interface ScryfallList<T> {
  object: 'list';
  data: T[];
  has_more: boolean;
  next_page?: string;
  total_cards?: number;
}

export interface ScryfallSet {
  object: 'set';
  id: string;
  code: string;
  name: string;
  set_type: string;
  released_at?: string;
  card_count: number;
  icon_svg_uri: string;
  digital: boolean;
}

export type Board = 'commander' | 'main' | 'side';

export interface DeckEntry {
  card: ScryfallCard;
  qty: number;
  board: Board;
}

export type Format = 'commander' | 'standard' | 'pioneer' | 'modern' | 'legacy' | 'vintage' | 'pauper';

export interface Deck {
  id: string;
  name: string;
  format: Format;
  entries: DeckEntry[];
  createdAt: number;
  updatedAt: number;
}
