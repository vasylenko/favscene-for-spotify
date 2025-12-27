# FavScene for Spotify

Minimalistic web application, a one-tap launcher for Spotify playlists on preferred devices. A "scene" is a saved "music + device" combination, for example "Country playlist with Alexa speakers".

## Tech Stack

- **Frontend**: Vue 3.5 + Vite 7 + TypeScript 5
- **Routing**: Vue Router 4
- **Styling**: UnoCSS (Tailwind-compatible utility classes)
- **Auth**: Spotify OAuth 2.0 with PKCE (browser-only, no backend)
- **Hosting**: Static SPA (Cloudflare Pages)
- **Storage**: Browser localStorage (user tokens + scenes)
- **Package Manager**: pnpm

## Project Structure

```
# Root (config files)
index.html          # Vite entry point, loads /src/main.ts
vite.config.ts      # Build config, plugins, path aliases
tsconfig.json       # TypeScript compiler options
uno.config.ts       # UnoCSS theme and utilities
wrangler.jsonc      # Cloudflare Pages deployment config

# Application code
src/
├── views/              # Page components (routes)
│   ├── HomeView.vue    # Main screen with scene grid
│   ├── CreateSceneView.vue  # Scene creation wizard
│   └── CallbackView.vue     # OAuth callback handler
├── composables/        # Reusable stateful logic
│   ├── useSpotifyAuth.ts    # Auth state, login, token refresh
│   └── useScenes.ts         # Scene CRUD, localStorage sync
├── services/           # External API calls
│   └── spotifyApi.ts        # Spotify Web API wrapper
├── types/              # TypeScript interfaces
├── router/             # Vue Router config
├── config.ts           # App config (Spotify client ID, URLs)
├── main.ts             # App entry point
└── App.vue             # Root component
docs/
├── PRD.md              # Product Requirements Document (read first!)
├── guidelines-spotify.md    # Spotify branding/UX guidelines
└── features/           # Feature specs (TODO-*.md files)
```

## Key Constraints

- No backend server - everything runs in browser
- Spotify Premium required for playback control
- Device IDs from Spotify may change - treat as hints, handle gracefully

## Commands

```bash
pnpm dev      # Start dev server (localhost:5173)
pnpm build    # Type-check + production build
pnpm preview  # Preview production build
```

## Documentation

- `docs/PRD.md` - Product Requirements Document with scope, data models, API references
- `docs/features/TODO-*.md` - Feature specs for upcoming work

**Read PRD.md before implementing features or making architectural decisions.**

## Design Principles

- YAGNI - Don't add features not explicitly needed
- KISS - Prefer simple solutions over clever ones
- Minimal changes - Smallest diff that achieves the goal
- Match existing style - Consistency over personal preference

## Dev Tooling

- **Chrome DevTools MCP** - For UI development, debugging, performance testing, e2e tests. All tools allowed in `.claude/settings.json`.
