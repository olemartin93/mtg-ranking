# Magic: ranked

A Progressive Web App for Magic: The Gathering that works offline on your phone.

**Live app:** https://olemartin93.github.io/mtg-ranking/

## Features

- **Card search** – every card, including newly previewed (unreleased) ones, with color/format filters and full [Scryfall search syntax](https://scryfall.com/docs/syntax).
- **Upcoming** – announced sets with a release countdown, the latest previewed cards, and recent releases.
- **Deck builder** – Commander, Standard, Pioneer, Modern, Legacy, Vintage and Pauper. Mana curve, color pips, card types, price estimate, legality and deck-health checks (lands, ramp, draw, removal). Import/export Arena/MTGO text lists.
- **Synergy analysis** – detects themes (tokens, +1/+1 counters, sacrifice, graveyard, lifegain, spellslinger, artifacts, enchantments, landfall, blink, card draw, tribal), lists enablers and payoffs, shows which cards in your deck a card works with, and suggests popular on-theme cards in your colors.
- **Rankings** – most popular commanders, staples and new cards (EDHREC data via Scryfall), plus a ranking of your own decks.
- **Offline** – the app shell is precached; decks live on your device; cards and images you've viewed are cached.

## Install on your phone

Open the live link, then:
- **iPhone (Safari):** Share → *Add to Home Screen*.
- **Android (Chrome):** menu → *Install app* / *Add to Home screen*.

## Data sources

- [Scryfall API](https://scryfall.com/docs/api) – card data, images, sets, prices. Requests are rate-limited per Scryfall's guidelines.
- [EDHREC](https://edhrec.com) popularity ranks, as published by Scryfall (`edhrec_rank`).

A Content Security Policy only allows network calls to Scryfall.
Magic: The Gathering is © Wizards of the Coast. This is an unofficial fan app.

## Development

```bash
npm ci
npm run dev        # local dev server
npm test           # unit + component tests (Vitest)
npm run build      # type-check + production build
npm run verify     # check the build is an installable, offline-capable PWA
npm run e2e        # browser test on the build, incl. offline reload (needs Playwright Chromium)
npm run icons      # regenerate PNG icons from public/favicon.svg
```

Stack: React, TypeScript (strict), Tailwind CSS, Vite, vite-plugin-pwa (Workbox).
Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.
