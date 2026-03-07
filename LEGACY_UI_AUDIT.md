# Legacy UI Audit

This audit removes GUI elements that no longer represent a meaningful, user-facing control surface.

## Removed

### 1. Legacy preset plumbing
- Removed hidden UI/controller callbacks for the old preset actions.
- Code pointers removed:
  - `/Users/fdasaro/Desktop/Flatlander/src/ui/uiController.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/main.ts`
- Reason:
  - the buttons were already gone from the DOM,
  - the remaining code only preserved obsolete mutation paths and made the UI contract harder to reason about.

### 2. South click debug toggle
- Removed UI exposure for `Show Click Debug`.
- Code pointers removed:
  - `/Users/fdasaro/Desktop/Flatlander/index.html`
  - `/Users/fdasaro/Desktop/Flatlander/src/ui/uiController.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/main.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/render/canvasRenderer.ts`
- Reason:
  - debug-only visualization,
  - not part of the shipped user workflow,
  - no simulation effect.

### 3. Housing debug toggle
- Removed UI exposure for `Show Housing Debug`.
- Code pointers removed:
  - `/Users/fdasaro/Desktop/Flatlander/index.html`
  - `/Users/fdasaro/Desktop/Flatlander/src/ui/uiController.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/main.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/render/canvasRenderer.ts`
- Reason:
  - internal diagnostics for door targeting,
  - not intended as a stable user control,
  - not needed for understanding default behavior.

### 4. Topology-derived boundary selectors
- Removed read-only `Boundary` selectors from Spawn and Inspector.
- Code pointers removed:
  - `/Users/fdasaro/Desktop/Flatlander/index.html`
  - `/Users/fdasaro/Desktop/Flatlander/src/ui/uiController.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/ui/controlTruth.ts`
- Reason:
  - they never acted as editable parameters,
  - boundary is already derived from `World Topology`,
  - leaving them visible created redundant/no-op UI.

## Retained

Controls were retained when they satisfy at least one of:
- they immediately affect renderer/UI behavior,
- they immediately affect headless simulation policy,
- they are reset-scoped world generation controls with explicit help text,
- they are selection-scoped inspector controls that mutate the selected entity.

## Result

The remaining GUI is narrower and more truthful:
- no dead preset paths,
- no debug toggles in the public surface,
- no topology-derived no-op selectors,
- fewer parameters that appear editable while doing nothing.
