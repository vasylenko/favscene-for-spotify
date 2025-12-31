# Spotify Scenes - PRD

## Concept
A minimalistic web app to instantly launch favorite Spotify playlists on preferred devices with one tap.

Example user story: "I have a playlist I like to listen to while working and I want to play it on my B&O Beoplay M5 speaker if I work from home. This app allows me to save playlist+device+volume combo and start the playlist in one action instead of doing so from Spoify interface: find the playlist on the list, click device picker, click device, set the volume."

## Core Definitions
- **Scene**: A saved combination of music (playlist) + device

## Technical Constraints
- Serverless, browser-only (static web hosting compatible, i.e., Single Page Application)
- OAuth tokens stored in browser storage
- User preferences (scenes) stored in browser storage
- Multi-user support (each user authenticates with their own Spotify account)

## Limitations
- **Spotify Premium required** - Playback control API only works for Premium subscribers
- **Development Mode** - New Spotify apps limited to 25 authorized users until Extended Quota Mode is approved
- **Device ID instability** - Spotify device IDs may change; cached IDs should be treated as hints, not guarantees
- **Device visibility** - The Web API only returns devices where Spotify is actively running. Sleeping speakers, Google Cast devices, and other Spotify Connect targets won't appear until "woken up" by playing something on them first via the native Spotify app. This is a Spotify API limitation, not something we can work around.

## Spotify App Configuration
App registered at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).

With PKCE flow:
- `client_id` is **public** - embedded in frontend code, committed to repo
- `client_secret` is **not used** - PKCE eliminates the need for it
- User tokens are the only secrets, stored in user's browser only

## Development Phases
POC - proof of concept - bare minimum functions to validate the idea
MVP - minimum viable product - more features to be ready to share the app with real users

## UX Decisions

### Device Unavailability
When target device is offline/unavailable:
- Show quick picker of currently available devices
- User selects alternative, music plays

### Content Types
- POC: Playlists only
- MVP: Albums, podcasts, liked songs, artist radio

### Scene Creation
- POC: Wizard flow (pick playlist → pick device → name it → save)
- MVP: "Save recent" from recently played playlists

### Main Screen Layout
- Grid of ~6 scenes (3 rows × 2 columns)
- Tiles big enough for easy tapping, showing playlist artwork + scene name + device
- Flat list, no reordering for POC

### Playback Controls
- POC: Fire and forget - tap scene, show "Playing!" confirmation, done
- MVP: Active scene tile shows play/pause overlay button
- All other controls (skip, volume) always via native Spotify app

### Scene Switching
- Immediate switch, no confirmation
- App doesn't track Spotify state - just sends "play X on Y" command regardless of current playback

### Scene Management (Edit/Delete)
- POC: Not in scope
- MVP: Long-press tile → shows edit/delete options (works on mobile + desktop)

### First-Time User / Empty State
- Brief text explaining what the app does + "Connect to Spotify" button
- After login with no scenes: prompt to create first scene

## Tech Stack
- **Frontend**: Vue 3 (https://vuejs.org/guide/introduction.html) + Vite (https://vite.dev/guide/)
- **Hosting**: Static (GitHub Pages or similar)
- **Styling**: UnoCSS (https://unocss.dev/config/)

## Authentication

### Flow: OAuth 2.0 Authorization Code with PKCE
Required for browser-only SPAs. No backend needed.

**Steps:**
1. User clicks "Connect to Spotify"
2. App generates `code_verifier` (random string) + `code_challenge` (SHA-256 hash)
3. Redirect to Spotify with `code_challenge`
4. User logs in, Spotify redirects back with auth code
5. Browser exchanges code + `code_verifier` for tokens (no client secret needed)
6. Store tokens, auto-refresh before 1-hour expiry

**Implementation:**
- Custom `useSpotifyAuth()` Vue composable
- Uses Web Crypto API (`crypto.getRandomValues`, `SubtleCrypto.digest`) - supported in all modern browsers
- Reference: [Spotify PKCE Example](https://github.com/spotify/web-api-examples/tree/master/authorization/authorization_code_pkce)

**Redirect URI / Callback Handling:**

No backend required. The redirect URI is a route within the SPA itself.

How it works:
1. User clicks "Connect to Spotify" → browser redirects to Spotify's login page
2. After login, Spotify redirects to the registered redirect URI (e.g., `https://your-site.com/callback?code=xxx`)
3. Static host (GitHub Pages) serves the same `index.html` for all routes (SPA behavior)
4. Vue app loads, Vue Router matches `/callback` route
5. The callback route component:
   - Reads the `code` parameter from the URL
   - Retrieves the stored `code_verifier` from sessionStorage
   - Makes a POST request directly to Spotify's token endpoint
   - Receives access + refresh tokens in response
   - Stores tokens in localStorage
   - Redirects user to main app view

Why no backend:
- PKCE allows the token exchange to happen from the browser
- The `code_verifier` proves the same app that started the flow is completing it
- Spotify's token endpoint accepts requests from browser JavaScript (CORS enabled)
- All secrets (tokens) stay in the user's browser

**Token Storage:** `localStorage`

Both `localStorage` and `IndexedDB` have identical security models - origin-scoped, readable by any JavaScript on the page. Neither protects against malicious browser extensions with site access permissions (this is a fundamental browser limitation, not solvable in client-side code).

Why `localStorage` over `IndexedDB`:
- Simpler synchronous API (`getItem`/`setItem` vs async transactions)
- Sufficient capacity (~5MB vs ~50MB) - we store ~500 bytes
- Easier to debug in DevTools
- Industry standard for OAuth SPAs (used by Spotify's own PKCE examples)

`IndexedDB` would be appropriate for caching large datasets (playlists, images) for offline use, but that's not in scope.

**Required Scopes:**
- `user-read-playback-state` - check current playback
- `user-modify-playback-state` - start/pause playback
- `user-read-private` - read user profile
- `playlist-read-private` - access user's playlists
- `playlist-read-collaborative` - access collaborative playlists

## Error Handling
- POC: Show detailed error messages (API errors, token failures, etc.) - helps debugging
- MVP: User-friendly messages with troubleshooting guides

## Data Model

### Scene 
```
{
  id: string,          // UUID, generated locally
  name: string,        // User-defined scene name
  // MVP: icon, color
  playlist: {
    id: string,        // Spotify playlist ID
    name: string,      // For display
    uri: string,       // spotify:playlist:xxx (used for playback API)
    imageUrl: string   // First image from images[] array
  },
  device: {
    id: string,        // Spotify device ID (⚠️ may become stale)
    name: string,      // For display
    type: string       // "computer" | "smartphone" | "speaker" | etc.
  }
}
```

**Note:** Device IDs are not guaranteed persistent by Spotify. If device not found at playback time → show device picker.

### Spotify API References
- [Get Playlist](https://developer.spotify.com/documentation/web-api/reference/get-playlist)
- [Get Available Devices](https://developer.spotify.com/documentation/web-api/reference/get-a-users-available-devices)
- [Start/Resume Playback](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback)

---

## Proof of Concept (POC)

### Success Criteria
- [x] User can authenticate with Spotify (PKCE flow)
- [x] User can create at least one scene (wizard: playlist → device → name)
- [x] Tapping a scene starts playback on the selected device
- [x] Scenes persist across browser sessions (localStorage)
- [x] Basic error messages shown when things fail

### Out of Scope for POC
- Edit/delete scenes
- Play/pause controls on scene tiles
- Multiple content types (albums, podcasts, etc.)
- "Save recent" scene creation flow
- Custom icons/colors for scenes
- Scene reordering
- IndexedDB storage
- User-friendly error messages with guides
- Mobile-specific optimizations
- Logout flow
- Offline handling

---

## Minimum Viable Product (MVP)

### Technical Improvements
- [x] Migrate to official Spotify TypeScript SDK (`@spotify/web-api-ts-sdk`) - better types, built-in token refresh, maintained by Spotify
- [x] Rename everywhere to "FavScene for Spotify"
- [x] Validate for KISS / YAGNI / DRY
- [x] Sensitive info checkup
- [x] Unused variables, functions cleanup
- [x] Log levels (default - error) and check what we emit to console
- [x] README explains the project essense, warns about active development phase, and then explains how it works, design principles, and tech stack behind (bfiefly) -- targeted on end users, not developers of the project
- [x] CLAUDE.md updated with layout and tech stack details, and tooling details -- targeted as it would target real senior developers (mind the level of ephasizing on details where needed vs. skipping the obvious for senior level) who work on the project
- [x] Validate codestyle:
    - [x] TS and Vue-specific best practices
    - [x] comments answer 'why' not 'what'
    - [x] self-documented names of variables and functions
    - [x] no magic numbers or other hardcoded values buried in the code

### Features
- [x] P0 - Edit/delete for saved scene to change playlist or device or volume level
- [ ] P1 - User-friendly error messages with troubleshooting guides - [TODO-user-friendly-errors.md](docs/features/TODO-user-friendly-errors.md)
- [x] P0 - Support secure encrypted user preferences storage (Workers KV?) to allow access to the same scenes from different devices - [TODO-support-multiple-browsers.md](docs/features/TODO-support-multiple-browsers.md)
- [ ] P1 - Play/pause controls on active scene tile
- [x] P1 - Mobile-specific optimizations
- [ ] P2 - "Save recent" scene creation from recently played
- [ ] P2 - Multiple content types (albums, podcasts, liked songs) - [TODO-support-multiple-browsers.md](./features/TODO-support-multiple-browsers.md)
- [x] P3 - Logout 
- [ ] P3 - "comlpetely erase my data" flow

## Post MVP
- Try out LaunchDarkly for feature flags, e.g., when I want to test some new stuff 
- Try out CloudFlare Workers observability 