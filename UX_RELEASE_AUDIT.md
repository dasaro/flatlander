# UX Release Audit

## Scope

This note covers the GUI truthfulness sweep added ahead of the `1.0.0` preset freeze.

## Findings

### 1. Structurally impossible controls were not explained

- **Observed behavior**
  - Boundary selectors were visible even though movement boundary is always derived from `World Topology`.
  - Flatlander “Include Boundaries” looked available even when topology was toroidal and no boundaries existed.
- **Code pointers**
  - `/Users/fdasaro/Desktop/Flatlander/src/ui/uiController.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/main.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/core/topology.ts`
- **Fix**
  - Added explicit control-truth modeling in `/Users/fdasaro/Desktop/Flatlander/src/ui/controlTruth.ts`.
  - Boundary selectors now stay disabled with a concrete reason.
  - Flatlander boundary visibility is disabled when topology is `torus`.

### 2. Selection-only overlays looked active when no selection existed

- **Observed behavior**
  - Hearing overlay, talking overlay, focus-on-selected, contact network, and fog preview could remain interactive with no selected entity, even though they render only from a selected subject.
- **Code pointers**
  - `/Users/fdasaro/Desktop/Flatlander/src/ui/uiController.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/main.ts`
- **Fix**
  - Selection-aware overlay availability is now computed centrally in `/Users/fdasaro/Desktop/Flatlander/src/ui/controlTruth.ts`.
  - The corresponding controls are disabled with explicit reasons when no selection exists.

### 3. Master toggles did not consistently gate dependent controls

- **Observed behavior**
  - Peace-cry, reproduction, and some overlay sub-controls could remain editable even when the parent feature was off.
- **Code pointers**
  - `/Users/fdasaro/Desktop/Flatlander/src/ui/uiController.ts`
- **Fix**
  - Added deterministic gating for peace-cry, reproduction, environment, flatlander, and overlay sub-controls.
  - The UI now reflects real applicability instead of leaving dependent inputs generically enabled.

### 4. Reset-scoped environment controls looked immediate

- **Observed behavior**
  - `House Count`, `Town Population`, `Allow Triangular Forts`, `Allow Square Houses`, and `House Size` affect world generation, but the panel did not state that strongly enough.
- **Code pointers**
  - `/Users/fdasaro/Desktop/Flatlander/index.html`
  - `/Users/fdasaro/Desktop/Flatlander/src/main.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/core/worldgen/houses.ts`
- **Fix**
  - Added explicit panel hints in `/Users/fdasaro/Desktop/Flatlander/index.html`.
  - Enabled controls now carry titles describing whether they apply immediately or on reset.

## Verification added

- Pure applicability tests in `/Users/fdasaro/Desktop/Flatlander/tests/controlTruth.test.ts`
- Existing inspector button tests remain in `/Users/fdasaro/Desktop/Flatlander/tests/uiInspectorButtons.test.ts`

## Remaining work after this audit

- Freeze the canonical `1.0.0` release preset.
- Tune the full-horizon stability harness against that frozen preset.
