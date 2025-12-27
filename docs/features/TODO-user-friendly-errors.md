# Feature: User-Friendly Error Messages

## Problem

Error messages are currently technical and unhelpful. Users see things like "Failed to fetch playlists" or "Playback restricted - Premium required" without knowing what to do next.

## Solution

Replace technical errors with user-friendly messages that explain what happened and provide actionable troubleshooting steps.

## UX Design

### Error Display Component

Current: Simple red text box with dismiss button

```
┌────────────────────────────────────────────┐
│ ⚠️  Failed to fetch devices        [×]    │
└────────────────────────────────────────────┘
```

Proposed: Expandable error with troubleshooting steps

```
┌────────────────────────────────────────────┐
│ ⚠️  No devices found                       │
│                                            │
│ Spotify isn't running on any of your       │
│ devices. Here's how to fix it:             │
│                                            │
│ • Open Spotify on your phone or computer   │
│ • Play any song briefly to wake up speakers│
│ • Come back here and try again             │
│                                            │
│ [Try Again]                    [Dismiss]   │
└────────────────────────────────────────────┘
```

Why expandable instead of inline:
- More room for troubleshooting steps
- Doesn't overwhelm UI when no errors
- User can dismiss once they've read it

### Error Categories & Messages

| Error Type | Current Message | User-Friendly Message | Troubleshooting |
|------------|-----------------|----------------------|-----------------|
| No devices | "No devices found" | "No devices found" | "Open Spotify on a device first, play any song briefly, then try again" |
| Device offline | "Device not found or offline" | "Device unavailable" | "The speaker/device might be sleeping. Open Spotify and play something on it first" |
| Premium required | "Premium required" | "Spotify Premium needed" | "Remote playback only works with a Spotify Premium account" |
| Auth expired | "Authentication expired" | "Session expired" | "Your Spotify session ended. Please reconnect" |
| Network error | "Failed to fetch..." | "Connection problem" | "Check your internet connection and try again" |
| Rate limited | API error | "Too many requests" | "Spotify is busy. Wait a moment and try again" |

## Architecture

### Error Type Hierarchy

```
Error Categories:
├── Authentication
│   ├── expired → prompt re-login
│   └── missing → redirect to login
│
├── Device
│   ├── none_found → show "open Spotify" guide
│   ├── offline → show device picker + wake-up tips
│   └── not_supported → explain limitation
│
├── Playback
│   ├── premium_required → explain Spotify Premium need
│   ├── restricted → content not available in region
│   └── generic → retry suggestion
│
└── Network
    ├── offline → check connection
    └── rate_limited → wait and retry
```

## Implementation

### Error Mapping Flow

```
API error received
  │
  ├─► HTTP 401 → "Session expired"
  │               + "reconnect" action
  │
  ├─► HTTP 403 → Check error.message
  │               ├─► "Premium" → "Spotify Premium needed"
  │               └─► other → "Playback restricted"
  │
  ├─► HTTP 404 → "Device unavailable"
  │               + show device picker
  │
  ├─► HTTP 429 → "Too many requests"
  │               + auto-retry after delay
  │
  ├─► Network error → "Connection problem"
  │                   + "check internet" tip
  │
  └─► Other → "Something went wrong"
              + generic retry
```

### ErrorMessage Component

```
Props:
  - type: 'auth' | 'device' | 'playback' | 'network'
  - code: string (specific error code)
  - onRetry?: () => void
  - onDismiss: () => void

Template structure:
  ┌─────────────────────────────────┐
  │ [Icon] [Title]                  │
  │                                 │
  │ [Description paragraph]         │
  │                                 │
  │ [Bullet list of steps]          │
  │                                 │
  │ [Action buttons]                │
  └─────────────────────────────────┘
```

### Error Registry Pattern

```
Define error configs in one place:

errors = {
  DEVICE_NOT_FOUND: {
    title: "Device unavailable",
    description: "Your saved device isn't responding",
    steps: [
      "Open Spotify on the device",
      "Play any song briefly",
      "Try again"
    ],
    actions: ['retry', 'pick_device']
  },
  ...
}

Usage:
  Map API error → error code → display config
```

## Files to Change

| File | Change |
|------|--------|
| `src/components/ErrorMessage.vue` | New component for error display |
| `src/utils/errorMapping.ts` | New file: error code → user message mapping |
| `src/services/spotifyApi.ts` | Return error codes instead of raw messages |
| `src/views/HomeView.vue` | Use ErrorMessage component |
| `src/views/CreateSceneView.vue` | Use ErrorMessage component |
| `src/views/CallbackView.vue` | Use ErrorMessage component |

## Edge Cases

| Case | Handling |
|------|----------|
| Multiple errors at once | Show most recent, queue others |
| Error during retry | Replace previous error with new one |
| Error auto-clears | Don't auto-clear - user must dismiss (they might want to read steps) |
| Very long error message from API | Truncate, log full message to console for debugging |
| Unknown error type | Fall back to generic "Something went wrong" with retry |

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Error registry pattern | Single source of truth, easy to maintain, consistent messages |
| No auto-dismiss | User needs time to read troubleshooting steps |
| Include retry button | Most errors are transient, retry is the common action |
| No error codes shown to user | Confuses non-technical users; log to console instead |
| Group by category (auth/device/playback/network) | Helps select appropriate icon and action buttons |
