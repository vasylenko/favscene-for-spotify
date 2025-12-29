# Feature: Cross-Browser Scene Sync

## Problem

Scenes are stored in `localStorage`, which is browser-specific. Same user opening the app in Chrome and Safari starts fresh each time.

## Solution

Store scenes in Cloudflare KV, keyed by Spotify user ID. Use short-lived Spotify access token for authentication.

## Architecture

### 1. Authentication (unchanged)

Browser handles OAuth directly with Spotify. Worker is not involved.

```
Browser                                                      Spotify
   │                                                            │
   │  OAuth PKCE flow                                           │
   │───────────────────────────────────────────────────────────►│
   │◄───────────────────────────────────────────────────────────│
   │  access_token, refresh_token → stored in localStorage      │
```

### 2. Scene Sync (new)

Browser sends existing token to Worker. Worker validates it with Spotify, then accesses KV.

```
Browser                         Worker                       Spotify API
   │                               │                             │
   │  GET /api/scenes              │                             │
   │  Authorization: Bearer xxx    │                             │
   │──────────────────────────────►│                             │
   │                               │  GET /v1/me                 │
   │                               │  (is token valid?)          │
   │                               │────────────────────────────►│
   │                               │◄────────────────────────────│
   │                               │  { id: "abc123" }           │
   │                               │                             │
   │                               │       KV                    │
   │                               │  ┌─────────────┐            │
   │                               │──│scenes:abc123│            │
   │                               │◄─└─────────────┘            │
   │                               │                             │
   │◄──────────────────────────────│                             │
   │  { scenes: [...] }            │                             │
```

Worker does NOT issue or refresh tokens - only validates them.

## Security Model

**Authentication:** Spotify OAuth token validates user identity.

**Access Control:** Worker only allows access to `KV[scenes:{user_id}]` if the provided token resolves to that `user_id` via Spotify's `/me` endpoint.

**Why this is secure:**
- Attacker knows `user_id`? Useless without valid Spotify token.
- Attacker calls API without token? 401 Unauthorized.
- Attacker uses their own token? Can only access their own data.
- Token rotation? Doesn't matter - `user_id` is stable, token is validated fresh each request.

## API Design

### GET /api/scenes

Fetch user's scenes.

**Request:**
```
GET /api/scenes
Authorization: Bearer {spotify_access_token}
```

**Response:**
```json
{
  "scenes": [
    {
      "id": "uuid",
      "name": "Morning Work",
      "volume": 15,
      "playlist": { "id": "...", "name": "...", "uri": "...", "imageUrl": "..." },
      "device": { "id": "...", "name": "...", "type": "..." }
    }
  ]
}
```

### PUT /api/scenes

Save user's scenes (full replacement).

**Request:**
```
PUT /api/scenes
Authorization: Bearer {spotify_access_token}
Content-Type: application/json

{
  "scenes": [...]
}
```

**Response:**
```json
{ "ok": true }
```

## Implementation

### HTTPS ABSOLUTE

The Cloudflare Worker for the logic and static assets MUST be configured to use HTTPS only and redirect all HTTP to HTTPS - tokens in cleartext would be catastrophic.

### Worker Algorithm

```
REQUEST comes in
  │
  ├─► Is it OPTIONS? (CORS preflight)
  │     YES → Return 200 with CORS headers, no body
  │     NO  ↓
  │
  ├─► Is it /api/* route?
  │     NO  → Serve static assets (SPA)
  │     YES ↓
  │
  ├─► Extract Authorization header
  │     Missing → 401 Unauthorized
  │     Present ↓
  │
  ├─► Call Spotify GET /v1/me with token
  │     Failed  → 401 Invalid token
  │     Success → Extract user_id from response
  │
  ├─► Build KV key: "scenes:{user_id}"
  │
  ├─► Route by method:
  │     GET  → Read from KV, return scenes (or empty array)
  │     PUT  → Write request body to KV, return ok
  │     else → 404 Not found
  │
  └─► Add CORS headers to response
```

#### CORS Headers

Worker must add these headers to ALL responses (including errors):

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, PUT, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
```

Why: Browser sends `Authorization` header → triggers CORS preflight → Worker must handle `OPTIONS` and allow the header.

### Wrangler Config

Add to `wrangler.jsonc`:
- `main` - path to Worker entry point
- `kv_namespaces` - bind KV namespace for scenes storage

### Client-Side Changes (useScenes.ts)

**Auth timing:** Current POC loads scenes at module init, before user is logged in. With API sync, must fetch AFTER auth:

```
App starts
  │
  ├─► User logged in? (token exists)
  │     NO  → Show login screen, no API call
  │     YES ↓
  │
  └─► Fetch scenes from API
        Success → Store in reactive state
        401     → Token invalid, trigger re-auth
        Error   → Show error message, scenes = []
```

**Error handling:**
- Network error → Show "Can't connect" message, allow retry
- 401 response → Token expired/invalid, redirect to login
- 500 response → Show "Server error" message

**On save:**
- Call PUT /api/scenes with current access token
- On 401 → Refresh token, retry once
- On failure → Show error, keep local state (user can retry)

## Decision Log 

| Decision | Trade-off |
|----------|-----------|
| No E2E encryption | We *can* read user scenes if we wanted, but we don't. Trust is acceptable for low-sensitivity data (playlist IDs, device names). |
| Spotify token validation per request | Adds ~100ms latency (Spotify API call). Could cache validation with short TTL. |
| Full scene replacement on save (no itemized PATCH/DELETE) | KISS but not efficient for single-scene edits. Acceptable for small data (<10KB ~ 25 scenes is more than enough). |

### Privacy Considerations

**What we store:**
- Spotify user ID (pseudonymous identifier)
- Scene data: playlist IDs, device IDs, scene names, volume settings

**What we DON'T store:**
- Spotify tokens (validated per-request, never persisted)
- Email, display name, or other PII

**Data access:**
- Only the authenticated user can access their scenes
- We (operators) could technically read KV contents, but:
  - Data is low-sensitivity (not financial, not health, not messages)
  - No PII stored
  - Clear privacy policy recommended
  - We can always make this more complex and secure if users demand (though this will require them to use +1 step in UX)


### Product Security Concerns

**1. ~~MEDIUM~~ NON-ISSUE: Shared KV Write Quota**

~~Why it's a flaw: Cloudflare KV free tier has a global limit of 1,000 writes/day across all users. A single malicious actor with a valid Spotify token could exhaust this by spamming PUT /api/scenes.~~

**Correction**: KV limits are "1,000 writes/day to different keys" and "1 write/second to same key". Each user writes to their own key (`scenes:{user_id}`), so a single user is limited to 1 write/second. Exhausting the 1,000/day quota requires ~1,000 different legitimate Spotify users - a scaling milestone, not an attack. If Spotify considers them legitimate users, so should we. Upgrade to paid plan when needed.

**2. LOW: No Request Body Size Limit Specified (IMPLEMENTED)**

Why it's a flaw: The design doesn't specify payload limits for PUT /api/scenes. An attacker could send massive JSON payloads.

Impact: Worker memory consumption, potential storage cost overrun, and corrupted/bloated user data.

Consequence if not fixed: Resource abuse. Cloudflare has implicit limits (~128KB for Workers), but relying on infrastructure defaults isn't defense-in-depth.

Mitigation: Explicit limit in Worker code (e.g., reject if body > 50KB). Also validate scene array length (e.g., max 50 scenes as the doc already suggests is "more than enough").

**3. LOW: Spotify API Rate Limit Dependency**

Why it's a flaw: Every request to your Worker triggers a call to Spotify's /v1/me. An attacker flooding your API with garbage tokens still causes outbound calls to Spotify.

Impact: Spotify may rate-limit your Worker's IP range, blocking token validation for legitimate users.

Consequence if not fixed: Service availability depends on an external party's rate limits that you don't control. An attacker who doesn't even have a valid token can cause disruption.

Mitigation: Rate-limit requests before calling Spotify (by IP or token hash). Optionally, cache validated token→user_id mappings with short TTL (5-10 min). The doc already mentions this as a potential optimization.

### Alternatives Considered

- E2E Encryption with Passphrase. User provides passphrase → derive encryption key → encrypt scenes before upload. **Rejected:** Bad UX - Adds UX friction (user must remember passphrase). Over-engineering for a music scenes app.
- E2E Encryption with Spotify Email. Ask user to enter Spotify email (we don't request email scope) → derive key from email. **Rejected:** Bad UX - Still requires user input. Marginal privacy benefit vs complexity.
- WebAuthn PRF. Use passkeys to derive encryption key. **Rejected:** Overkill – complicated and browser support fragmented in 2025, especially iOS/Firefox.
- QR Code Pairing. First device shows QR with encryption key, second device scans. **Rejected:** Overkill – zero typing, but requires devices physically together.

## Future Enhancements

1. **Encryption at rest:** Encrypt KV data using app secret + user_id. Worker derives unique key per user via `HKDF(APP_SECRET, user_id)`, encrypts with AES-GCM. Protects against raw KV access (data leaks, Cloudflare employee snooping). No user input needed - transparent to users.

2. **Optional E2E encryption:** For privacy-conscious users, add opt-in passphrase encryption

3. **WebAuthn PRF:** When browser support matures, add as seamless E2E option

## Cost

Cloudflare KV free tier: 100,000 reads/day, 1,000 writes/day.

Estimated usage per user: ~10 reads + ~5 writes per day.

**Free tier supports ~10,000+ active users.**
