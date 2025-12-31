# Feature: Erase All Data

## Problem

Users have no way to completely remove their data from FavScene. Good practice to give users full control over their data.

## Solution

Add "Erase all data" option that deletes scenes from KV, clears localStorage, and revokes Spotify app authorization.

## UX Design

```
┌─────────────────────────────┐
│ FavScene          user ▾   │
│                    ┌──────┐│
│                    │Logout││
│                    │──────││
│                    │Erase ││  ◄── New option in user menu
│                    │ data ││
│                    └──────┘│
└─────────────────────────────┘
            │
            ▼ tap "Erase data"
┌─────────────────────────────┐
│                             │
│   ⚠️ Erase All Data?        │
│                             │
│   This will permanently:    │
│   • Delete all your scenes  │
│   • Revoke Spotify access   │
│   • Log you out             │
│                             │
│   ┌────────┐  ┌──────────┐  │
│   │ Cancel │  │  Erase   │  │
│   └────────┘  └──────────┘  │
│                    ↑        │
│               Red/danger    │
└─────────────────────────────┘
            │
            ▼ tap "Erase"
┌─────────────────────────────┐
│                             │
│   FavScene for Spotify      │
│                             │
│   [Connect to Spotify]      │  ◄── Back to login screen
│                             │
└─────────────────────────────┘
```

## Implementation

```
User taps "Erase data"
        │
        ▼
  Show confirmation modal
        │
        ▼
  User confirms?
        │
   ┌────┴────┐
   No       Yes
   │         │
   ▼         ▼
 Close    Delete scenes from KV (API call)
 modal           │
                 ▼
           Clear localStorage
           (scenes, user, SDK tokens)
                 │
                 ▼
           Revoke Spotify access
           (SDK provides this?)
                 │
                 ▼
           Redirect to login screen
```

**API endpoint:**

```
DELETE /api/scenes
        │
        ▼
  Validate auth token
        │
        ▼
  Delete user's KV entry
        │
        ▼
  Return { ok: true }
```

## Edge Cases

| Scenario | Handling |
|----------|----------|
| API call fails | Show error, don't clear local data (keep consistent) |
| User is offline | Show error "Cannot erase data while offline" |
| Already logged out | Option not visible (only in user menu when authenticated) |
| KV entry doesn't exist | Treat as success, continue with local cleanup |

## Decision Log

| Decision | Options | Rationale |
|----------|---------|-----------|
| Single confirmation modal | A) Single modal B) Type "DELETE" C) Multi-step | Simple UX, explicit enough with clear bullet points of consequences |
| Delete KV first, then local | A) KV first B) Local first C) Parallel | If KV fails, user can retry. If local cleared first and KV fails, inconsistent state |
| Revoke Spotify via SDK | A) SDK logout B) Direct API call | SDK's `logOut()` clears tokens. Full revoke requires user to visit Spotify settings - document this |

## Open Questions

- Does `sdk.logOut()` actually revoke the app, or just clear local tokens? If just local, should we mention "To fully revoke access, visit Spotify account settings"?

## Files to Change

- `worker/index.ts` - Add `DELETE /api/scenes` endpoint
- `src/services/api.ts` - Add `deleteAllScenes()` function
- `src/views/HomeView.vue` - Add menu option + confirmation modal
- `src/composables/useSpotifyAuth.ts` - Ensure `clearAuth()` is reusable
