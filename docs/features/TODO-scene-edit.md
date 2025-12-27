# Feature: Edit & Delete Scenes

## Problem

Users can create scenes but cannot modify or remove them. To fix a mistake or change preferences, they'd need to clear localStorage manually.

## Solution

Add edit and delete capabilities to existing scenes via long-press interaction (works on mobile + desktop).

## UX Design

### Triggering Edit Mode

```
User long-presses scene tile (500ms)
  │
  └─► Show action menu:
        ┌─────────────┐
        │ ✏️  Edit     │
        │ 🗑️  Delete   │
        │ ─────────── │
        │    Cancel   │
        └─────────────┘
```

Why long-press:
- Single tap already plays the scene
- Works identically on mobile (touch) and desktop (mouse hold)
- Familiar pattern (iOS/Android home screen icons)

### Edit Flow

Reuse existing CreateSceneView wizard with pre-filled values:

```
User selects "Edit"
  │
  └─► Navigate to /edit/:id
        │
        └─► Wizard loads with current scene data:
              Step 1: Playlist picker (current highlighted)
              Step 2: Device picker (current highlighted)
              Step 3: Name + Volume (current values)

              [Save Changes] button instead of [Create Scene]
```

Why reuse wizard:
- No new UI to build
- Consistent experience
- All validation already exists

### Delete Flow

```
User selects "Delete"
  │
  └─► Show confirmation dialog:
        ┌──────────────────────────────┐
        │  Delete "Morning Work"?      │
        │                              │
        │  This cannot be undone.      │
        │                              │
        │  [Cancel]  [Delete]          │
        └──────────────────────────────┘
```

Why confirm:
- Destructive action
- No undo feature
- One extra tap is acceptable for safety

## Implementation

### useScenes.ts - Add Functions

```
updateScene(id, updates)
  │
  ├─► Find scene by id
  │     Not found → return false
  │     Found ↓
  │
  ├─► Merge updates into scene (keep id unchanged)
  │
  ├─► Save to localStorage
  │
  └─► return true


deleteScene(id)
  │
  ├─► Filter out scene with matching id
  │
  ├─► Save to localStorage
  │
  └─► return true
```

### HomeView.vue - Add Long-Press Handler

```
Scene tile events:
  - @click → playScene() (existing)
  - @mousedown + @touchstart → start 500ms timer
  - @mouseup + @touchend → cancel timer if < 500ms
  - Timer fires → show action menu
```

Why not @contextmenu (right-click):
- Doesn't work on mobile
- Long-press is more consistent cross-platform

### New Route: /edit/:id

```
Router:
  /edit/:id → EditSceneView.vue

EditSceneView:
  - Load scene by id from useScenes
  - If not found → redirect to home
  - Render same wizard steps as CreateSceneView
  - On save → call updateScene() instead of addScene()
  - Navigate back to home
```

### Component Reuse Strategy

Option A: Duplicate CreateSceneView → EditSceneView (bad - code duplication)

Option B: Add `mode` prop to CreateSceneView (okay - but muddies component)

**Option C (recommended):** Extract wizard steps into composable, use in both views

```
useSceneWizard(initialScene?: Scene)
  │
  ├─► Reactive state: currentStep, selectedPlaylist, selectedDevice, name, volume
  │
  ├─► If initialScene provided → populate state from it
  │
  └─► Return: state + navigation functions + validation
```

Both CreateSceneView and EditSceneView use same composable, differ only in:
- Initial state (empty vs pre-filled)
- Submit action (addScene vs updateScene)
- Button label ("Create" vs "Save")

## Files to Change

| File | Change |
|------|--------|
| `src/composables/useScenes.ts` | Add `updateScene()`, `deleteScene()` |
| `src/composables/useSceneWizard.ts` | New - extract wizard logic |
| `src/views/HomeView.vue` | Add long-press handler, action menu |
| `src/views/CreateSceneView.vue` | Refactor to use useSceneWizard |
| `src/views/EditSceneView.vue` | New - edit mode using useSceneWizard |
| `src/router/index.ts` | Add `/edit/:id` route |

## Edge Cases

| Case | Handling |
|------|----------|
| Edit scene that no longer exists | Redirect to home (another tab deleted it) |
| Long-press while scene is playing | Still show menu (playing state is visual only) |
| Delete last scene | Allow it, show empty state |
| Edit with no available devices | Same as create - show "no devices" message |

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Long-press trigger | Works on all platforms, doesn't conflict with tap-to-play |
| Reuse wizard for edit | KISS - no new UI, consistent UX, less code |
| Confirmation for delete only | Edit is reversible (just edit again), delete is not |
| Extract useSceneWizard | DRY - shared logic, easier testing, cleaner views |
