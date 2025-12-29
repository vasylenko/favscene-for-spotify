# FavScene for Spotify

Minimalistic SPA for one-tap Spotify playback of favorite scenes. A "scene" = playlist + device + volume level.

## Tech Stack

- Vue 3 + Vite + TypeScript (Composition API, `<script setup>`)
- UnoCSS (Tailwind-compatible)
- Spotify OAuth 2.0 with PKCE via `@spotify/web-api-ts-sdk`
- Cloudflare Workers + KV (scene storage, encrypted)
- localStorage for auth state (SDK-managed)

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

worker/
├── index.ts                  # Cloudflare Worker entry point (API routes)
└── crypto.ts                 # AES-256-GCM encryption for KV data

docs/
├── PRD.md                    # Product requirements (read first)
├── guidelines-spotify.md    # Spotify branding/UX guidelines
├── decision-log.md          # Architecture decisions with rationale
└── features/                 # Feature specs (TODO-*.md, IMPLEMENTED-*.md)
```

## Architecture Decisions

**SDK Singleton (`services/spotify.ts`)**: Single `SpotifyApi` instance, lazily initialized. SDK handles PKCE, token storage (`localStorage`), and auto-refresh internally.

**Module-level State in Composables**: `useSpotifyAuth` and `useScenes` use module-level `ref()` outside the exported function. This creates app-wide singletons — all components share the same state without prop drilling or Pinia.

**localStorage over IndexedDB**: Sync API is simpler, data is small (scenes + user profile), no need for complex queries.

**Wrapper Functions in `spotify.ts`**: Thin wrappers around SDK methods to handle errors consistently and return app-specific result types. Views don't touch SDK directly.

## Local Development Setup

### 1. Get Spotify Client ID

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create an app (or use existing)
3. Add `http://localhost:5173/callback` to Redirect URIs
4. Copy your Client ID

### 2. Create Environment File

```bash
cp .env.example .env
```

Edit `.env` and set your Spotify Client ID:
```bash
VITE_SPOTIFY_CLIENT_ID=your_client_id_here
```

### 3. Run Development Servers

```bash
pnpm install
pnpm build          # Required once for Wrangler assets
pnpm dev:full       # Starts both Vite and Wrangler
```

This runs:
- **Vite** at `http://localhost:5173` — frontend with hot reload
- **Wrangler** at `http://localhost:8787` — Worker API (KV, encryption)

Open `http://localhost:5173` in your browser.

### Environment Files

| File | Purpose | Committed |
|------|---------|-----------|
| `.env.example` | Template for required vars | Yes |
| `.env` | Your Spotify Client ID | No (gitignored) |
| `.env.development` | Dev API URL (localhost:8787) | Yes |

## Commands

```bash
# Development
pnpm dev:full     # Start Vite + Wrangler dev servers (recommended)
pnpm dev          # Vite dev server only (localhost:5173)
pnpm worker:dev   # Wrangler dev server only (localhost:8787)

# Production
pnpm build        # Type-check + production build
pnpm worker:deploy # Build + deploy to Cloudflare
pnpm preview      # Preview production build locally
```

## CRITICAL CLAUDE CODE INSTRUCTIONS
1. You follow YAGNI - Don't add features not explicitly needed
2. You follow KISS - Prefer simple solutions over clever ones
3. You follow "Minimal valuable changes" - Smallest diff that achieves the goal
4. You always consult with official CloudFlare documentation for the respective feature, e.g. Worker when you work on any task realted to Workers or other CloudFlare product offering, e.g., the KV.

## Dev Tooling

**Chrome DevTools MCP**: Used for e2e testing and UI debugging. Config in `.mcp.json`, permissions in `.claude/settings.json`.

**Logger (`utils/logger.ts`)**: Centralized logging with level control. Use `logger.debug/info/warn/error()` instead of `console.*`. Production builds only show errors.

## Documentation

- `docs/PRD.md` — Product requirements, data models, API reference
- `docs/features/` — Feature specs

Read PRD.md before making architectural decisions.

