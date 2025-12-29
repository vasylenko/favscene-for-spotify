# Feature: Cross-Browser Scene Sync (Implemented)

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
   │                               │  hash(user_id) → KV key     │
   │                               │       KV                    │
   │                               │  ┌───────────────────────┐  │
   │                               │──│scenes:7f3a2b1c... [enc]│  │
   │                               │◄─└───────────────────────┘  │
   │                               │                             │
   │                               │  decrypt(data, user_id)     │
   │◄──────────────────────────────│                             │
   │  { scenes: [...] }            │                             │
```

Worker does NOT issue or refresh tokens - only validates them.

## Security Model

**Authentication:** Spotify OAuth token validates user identity.

**Access Control:** Worker only allows access to scenes if the provided token resolves to that user via Spotify's `/me` endpoint.

**Encryption:** Data encrypted with AES-256-GCM using user's Spotify ID as key derivation input. KV keys are hashed (SHA-256) to anonymize storage.

**Why this is secure:**
- Attacker knows `user_id`? Useless without valid Spotify token for API access.
- Attacker calls API without token? 401 Unauthorized.
- Attacker uses their own token? Can only access their own data.
- Token rotation? Doesn't matter - `user_id` is stable, token is validated fresh each request.
- KV data breach? Data is encrypted, keys are hashed - no PII visible.
- App owner snooping? Cannot bulk-decrypt without knowing each user's Spotify ID.

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
  ├─► Build KV key: "scenes:{sha256(user_id)}"
  │
  ├─► Route by method:
  │     GET  → Read from KV, decrypt(data, user_id), return scenes
  │     PUT  → encrypt(body, user_id), write to KV, return ok
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
| Encrypt with user ID as key | User ID → SHA-256 → AES-256-GCM key. Owner cannot bulk-decrypt without knowing each user's Spotify ID. Simple, no passphrase UX friction. |
| Hash user ID for KV key | KV keys are `scenes:{sha256(user_id)}` not raw IDs. Anonymizes storage - can't identify users from KV dashboard. |
| Spotify token validation per request | Adds ~100ms latency (Spotify API call). Could cache validation with short TTL. |
| Full scene replacement on save (no itemized PATCH/DELETE) | KISS but not efficient for single-scene edits. Acceptable for small data (<10KB ~ 25 scenes is more than enough). |

### Privacy Considerations

**What we store:**
- Hashed Spotify user ID as KV key (not reversible without knowing the original ID)
- Scene data: playlist IDs, device IDs, scene names, volume settings - **encrypted**

**What we DON'T store:**
- Spotify tokens (validated per-request, never persisted)
- Email, display name, or other PII
- Raw user IDs (only hashes)

**Data access:**
- Only the authenticated user can access their scenes via API
- KV dashboard shows only hashed keys and encrypted blobs
- Operators cannot read scene data without knowing each user's Spotify ID


### Alternatives Considered

- **No encryption (original plan).** Store plaintext JSON. **Rejected:** Exposed user data in KV dashboard - device names, playlist names visible.
- **Server-side encryption secret.** Single master key encrypts all data. **Rejected:** Owner can decrypt everything - worse privacy than user-ID-based keys.
- **E2E Encryption with Passphrase.** User provides passphrase → derive encryption key. **Rejected:** Bad UX - user must remember passphrase.
- **E2E Encryption with Spotify Email.** Derive key from email. **Rejected:** Requires email scope, still needs user input.
- **WebAuthn PRF.** Use passkeys to derive encryption key. **Rejected:** Overkill – complicated, fragmented browser support.
- **QR Code Pairing.** First device shows QR with key, second scans. **Rejected:** Overkill – requires devices physically together.

**Adopted:** Encrypt with user's Spotify ID as key derivation input. Zero UX friction, good privacy guarantees, simple implementation.
