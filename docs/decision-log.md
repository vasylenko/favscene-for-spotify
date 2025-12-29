# Core decisions on this project

## December 29, 2025

### KV Data Encryption

**Problem:** Scene data stored in Cloudflare KV was plaintext, exposing user IDs and personal data (device names, playlist names) to anyone with KV dashboard access (me).

**Solution:** Encrypt data using the user's Spotify ID as the encryption key.

**Why user ID as key (not a server secret):**
- Server secret = owner (me) can decrypt all users' data
- User ID as key = owner cannot bulk-decrypt without knowing each user's ID
- External attacker needs both KV access (my cloudflare account access technically) AND the specific username
- Better privacy guarantees for users

userId comes from Spotify's response, not from user input. An attacker can't forge a userId to decrypt someone else's data - they'd need a valid Spotify token for that user.

**Library choice:** `@noble/ciphers` - audited, zero dependencies, Cloudflare Workers compatible.

**Algorithm:** AES-256-GCM (authenticated encryption)

```
┌─────────────────────────────────────────────────────────────────┐
│                        WRITE FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  userId ──┬──► SHA-256 ──► truncate ──► KV Key                  │
│           │                             "scenes:a8f3b2c1..."    │
│           │                                                     │
│           └──► SHA-256 ──► AES-256-GCM Key                      │
│                                 │                               │
│                                 ▼                               │
│  scenes JSON ──► encrypt(key, random IV) ──► base64 ──► KV Value│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        READ FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  userId ──┬──► SHA-256 ──► truncate ──► KV Key lookup           │
│           │                                                     │
│           └──► SHA-256 ──► AES-256-GCM Key                      │
│                                 │                               │
│                                 ▼                               │
│  KV Value ──► base64 decode ──► decrypt(key, IV) ──► scenes JSON│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Where/when:**
- Encryption: Worker `handlePutScenes()` before `KV.put()`
- Decryption: Worker `handleGetScenes()` after `KV.get()`

Can't say it is pure KISS but I want to learn new stuff and keep things secure.

---

## December 24, 2025
General approach and source of the idea -- this is my own pain and I want to resolve it for myself: easy way to play favorite music on specific devices when I need that. Siri sucks, Spotify does not provide this. And I feel that I am not alone in that. Well, CloudFlare stats will show :-D

Keep it simple. As much as it's possible when code writing is done by Claude Code. But I steer it with my software design philosophy and experience. 

