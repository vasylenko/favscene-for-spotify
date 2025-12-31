# Feature: Play/Pause Controls on Active Scene

## Problem

After tapping a scene to play, users must open Spotify app to pause. The "Playing!" indicator disappears after 2 seconds with no way to control playback from FavScene.

## Solution

Show persistent play/pause control on the currently active scene tile.

## UX Design

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   [playlist]    │     │   [playlist]    │     │   [playlist]    │
│                 │     │                 │     │                 │
│  Meditation   ⋮ │ ──► │  Meditation  ⏸ │ ──► │  Meditation  ▶ │
│  MiniMe        │     │  MiniMe         │     │  MiniMe         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
    Tap scene           Playing (pause btn)     Paused (play btn)
```

**Controls placement:** Bottom-right of tile, replaces ⋮ menu on active tile only.

**Tap behavior:**
- Tile body → no action when active (prevents accidental restart)
- Play/pause button → toggle playback

## Implementation

```
User taps scene tile
        │
        ▼
  Is this tile active?
        │
   ┌────┴────┐
   No       Yes
   │         │
   ▼         ▼
Start      Tap on play/pause btn?
playback         │
   │        ┌────┴────┐
   ▼        No       Yes
Set as            │    │
active            │    ▼
   │              │  isPlaying?
   ▼              │    │
Show ⏸            │  ┌─┴─┐
                  │  Yes No
                  │   │   │
                  │   ▼   ▼
                  │  Pause Resume
                  │   │   │
                  │   ▼   ▼
                  │  Show Show
                  │   ▶   ⏸
                  │
                  ▼
              (ignore)
```

**State tracking:**

```
                    ┌──────────────────────────┐
                    │   Playback State         │
                    │   ─────────────────────  │
                    │   activeSceneId: string  │
                    │   isPlaying: boolean     │
                    └──────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
   playScene()           pausePlayback()        resumePlayback()
   success               success                success
        │                      │                      │
        ▼                      ▼                      ▼
   activeSceneId=id      isPlaying=false        isPlaying=true
   isPlaying=true
```

## Edge Cases

| Scenario | Handling |
|----------|----------|
| User controls Spotify elsewhere (phone/desktop) | State drifts. Accept this for MVP - common in music apps |
| Playback fails | Show error toast, reset active state |
| Device goes offline | Pause/resume fail silently, keep UI state |
| Scene deleted while active | Clear active state |
| Page refresh | Active state lost, no scene highlighted |

## Decision Log

| Decision | Options | Rationale |
|----------|---------|-----------|
| Local state only | A) Local state B) Poll Spotify API C) Hybrid | Polling adds complexity, rate limits, latency. Local state is simple (~40 lines). State drift is acceptable - users expect this from music apps |
| Replace ⋮ menu on active tile | A) Replace menu B) Add alongside menu | Cleaner UI, less clutter. Edit via long-press or when paused |
| **DEFERRED** | Implement now vs later | State sync complexity outweighs benefit for MVP. Revisit after core features stable |

## Files to Change

- `src/services/spotify.ts` - Add `pausePlayback()`, `resumePlayback()`
- `src/views/HomeView.vue` - State tracking, UI for controls
