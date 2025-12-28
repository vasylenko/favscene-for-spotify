# FavScene for Spotify

Minimalistic SPA for one-tap Spotify playback of favorite scenes. A "scene" = playlist + device + volume level.

## Tech Stack

- Vue 3 + Vite + TypeScript (Composition API, `<script setup>`)
- UnoCSS (Tailwind-compatible)
- Spotify OAuth 2.0 with PKCE via `@spotify/web-api-ts-sdk`
- Cloudflare Workers
- localStorage for persistence

## Project Structure

```
src/
├── views/                    # Route components
│   ├── HomeView.vue          # Scene grid, playback, device picker modal
│   ├── SceneWizardView.vue   # Create/edit scene (3-step wizard)
│   └── CallbackView.vue      # OAuth callback handler
├── composables/              # Shared reactive state (module-level singletons)
│   ├── useSpotifyAuth.ts     # Auth state, login/logout (SDK handles tokens)
│   └── useScenes.ts          # Scene CRUD, localStorage sync
├── services/
│   └── spotify.ts            # SDK singleton + wrapper functions
├── utils/
│   └── logger.ts             # Configurable log levels
├── types/index.ts            # Domain types (Scene, SpotifyDevice, etc.)
├── config.ts                 # Runtime config from env vars
├── router/index.ts           # Vue Router setup
├── main.ts                   # App bootstrap
└── App.vue                   # Root component

docs/
├── PRD.md                    # Product requirements (read first)
├── guidelines-spotify.md    # Spotify branding/UX guidelines
└── features/                 # Feature specs (TODO-*.md, IMPLEMENTED-*.md)
```

## Architecture Decisions

**SDK Singleton (`services/spotify.ts`)**: Single `SpotifyApi` instance, lazily initialized. SDK handles PKCE, token storage (`localStorage`), and auto-refresh internally.

**Module-level State in Composables**: `useSpotifyAuth` and `useScenes` use module-level `ref()` outside the exported function. This creates app-wide singletons — all components share the same state without prop drilling or Pinia.

**localStorage over IndexedDB**: Sync API is simpler, data is small (scenes + user profile), no need for complex queries.

**Wrapper Functions in `spotify.ts`**: Thin wrappers around SDK methods to handle errors consistently and return app-specific result types. Views don't touch SDK directly.

## Environment Variables

```bash
# Required
VITE_SPOTIFY_CLIENT_ID=xxx    # From Spotify Developer Dashboard

# Optional
VITE_LOG_LEVEL=debug          # debug|info|warn|error|silent (default: debug in dev, error in prod)
```

## Commands

```bash
pnpm dev      # Dev server at localhost:5173
pnpm build    # Type-check + production build
pnpm preview  # Preview production build locally
```

## Key Development Principles
- YAGNI - Don't add features not explicitly needed
- KISS - Prefer simple solutions over clever ones
- Minimal valuable changes - Smallest diff that achieves the goal

## Dev Tooling

**Chrome DevTools MCP**: Used for e2e testing and UI debugging. Config in `.mcp.json`, permissions in `.claude/settings.json`.

**Logger (`utils/logger.ts`)**: Centralized logging with level control. Use `logger.debug/info/warn/error()` instead of `console.*`. Production builds only show errors.

## Documentation

- `docs/PRD.md` — Product requirements, data models, API reference
- `docs/features/` — Feature specs

Read PRD.md before making architectural decisions.
