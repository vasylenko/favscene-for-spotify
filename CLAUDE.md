# Spotify Scenes

One-tap launcher for Spotify playlists on preferred devices. A "scene" is a saved "music + device" combination, for example "Country playlist with Alexa speakers".

## Tech Stack

- **Frontend**: Vue 3 + Vite
- **Styling**: UnoCSS
- **Auth**: Spotify OAuth 2.0 with PKCE (browser-only, no backend)
- **Hosting**: Static SPA (GitHub Pages or similar)
- **Storage**: Browser localStorage (user tokens + scenes)

## Key Constraints

- No backend server - everything runs in browser
- Spotify Premium required for playback control
- Device IDs from Spotify may change - treat as hints, handle gracefully

## Documentation

Detailed specs, data models, API references, and scope definitions:
- `docs/PRD.md` - Product Requirements Document

Read PRD.md before implementing features or making architectural decisions.

## Design Principles

- YAGNI - Don't add features not explicitly needed
- KISS - Prefer simple solutions over clever ones
- Minimal changes - Smallest diff that achieves the goal
- Match existing style - Consistency over personal preference
