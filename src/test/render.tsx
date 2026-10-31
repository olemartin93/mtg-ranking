import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DeckProvider } from '../lib/storage';
import { AppRoutes } from '../App';

export function renderApp(path = '/') {
  return render(
    <DeckProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </DeckProvider>,
  );
}
