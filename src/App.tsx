import { HashRouter, Route, Routes } from 'react-router-dom';
import { DeckProvider } from './lib/storage';
import { Layout } from './components/Layout';
import { SearchPage } from './pages/SearchPage';
import { CardPage } from './pages/CardPage';
import { UpcomingPage } from './pages/UpcomingPage';
import { DecksPage } from './pages/DecksPage';
import { DeckPage } from './pages/DeckPage';
import { RankingsPage } from './pages/RankingsPage';
import { Empty } from './components/ui';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<SearchPage />} />
        <Route path="card/:id" element={<CardPage />} />
        <Route path="upcoming" element={<UpcomingPage />} />
        <Route path="decks" element={<DecksPage />} />
        <Route path="deck/:id" element={<DeckPage />} />
        <Route path="rankings" element={<RankingsPage />} />
        <Route path="*" element={<Empty>Page not found.</Empty>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <DeckProvider>
      {/* Hash routing works on GitHub Pages without server rewrites. */}
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </DeckProvider>
  );
}
