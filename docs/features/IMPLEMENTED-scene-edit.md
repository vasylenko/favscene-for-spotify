# Feature: Edit & Delete Scenes

## Problem

Users can create scenes but cannot modify or remove them. To fix a mistake or change preferences, they'd need to clear localStorage manually.

## Solution

Add edit and delete capabilities via edit button on each scene tile.

## UX Design

### Triggering Edit Mode

Small edit button (⋮ or ✏️) in corner of scene tile:

```
┌─────────────────────┐
│                 [⋮] │  ← edit button (top-right corner)
│                     │
│   [playlist image]  │  ← tap anywhere else → play
│                     │
│   Scene Name        │
│   Device            │
└─────────────────────┘
```

Tap edit button → show action menu:
```
┌─────────────┐
│ ✏️  Edit     │
│ 🗑️  Delete   │
│ ─────────── │
│    Cancel   │
└─────────────┘
```

Why edit button (not long-press):
- Simpler implementation (no timers, no touch event conflicts)
- More discoverable (visible affordance)
- No conflict with tap-to-play or scrolling

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

### HomeView.vue - Add Edit Button

```
Scene tile structure:
  <button @click="playScene">        ← existing, plays scene
    <img ... />                      ← playlist image
    <div class="overlay">
      <button @click.stop="openMenu" ← NEW: edit button, .stop prevents playScene
        class="absolute top-2 right-2">
        ⋮
      </button>
    </div>
    <div>Scene name / device</div>
  </button>
```

Action menu: Reuse modal pattern from device picker (centered overlay).

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

Single component with `mode` prop (simpler than extracting composable):

```
Rename: CreateSceneView.vue → SceneWizardView.vue

Props:
  - mode: 'create' | 'edit'
  - sceneId?: string (required if mode='edit')

Behavior by mode:
  create:
    - Start with empty state
    - On submit → addScene()
    - Button label: "Create Scene"

  edit:
    - Load scene by sceneId on mount
    - Pre-fill wizard state from scene
    - On submit → updateScene()
    - Button label: "Save Changes"
```

Why single component (not composable extraction):
- Only 2 consumers (create/edit) - not worth abstraction overhead
- Mode prop keeps logic in one place
- Less files to maintain

## Files to Change

| File | Change |
|------|--------|
| `src/composables/useScenes.ts` | Add `updateScene()`, `deleteScene()` |
| `src/views/HomeView.vue` | Add edit button overlay, action menu modal |
| `src/views/CreateSceneView.vue` | Rename to `SceneWizardView.vue`, add mode prop |
| `src/router/index.ts` | Update `/create` route, add `/edit/:id` route |

## Edge Cases

| Case | Handling |
|------|----------|
| Edit scene that no longer exists | Redirect to home (another tab deleted it) |
| Delete last scene | Allow it, show empty state |
| Saved device offline in edit mode | Fetch fresh device list. If saved device found → highlight it. If not found → no pre-selection, user picks new device. |
| Saved playlist deleted on Spotify | We don't validate. User can keep it or pick a new one. Playback will fail gracefully if playlist gone. |

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Edit button (not long-press) | Simpler - no timers, no touch conflicts, more discoverable |
| Reuse wizard for edit | KISS - no new UI, consistent UX, less code |
| Confirmation for delete only | Edit is reversible (just edit again), delete is not |
| Single component with mode prop | Simpler than composable extraction - only 2 consumers, less files |
