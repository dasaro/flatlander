# Visual/UX Audit (Rain, Shelter, Dimming, Overlay Consistency)

## Scope
- Rain shelter behavior observability.
- Pregnancy highlighting visibility.
- HP/age dimming visibility.
- UI controls that appeared ineffective.
- Render-time consistency (snapshot vs mutable world reads).

## Findings and fixes

1. **Pregnancy highlight looked ineffective for women**
- Root cause: women are rendered as segments (stroke-only). Color override was applied to fill color, not stroke.
- Fix:
  - `/Users/fdasaro/Desktop/Flatlander/src/render/canvasRenderer.ts`
  - segment stroke now uses distinct pregnancy color (`#d9578a`) with slightly thicker line width.

2. **HP dimming appeared too weak**
- Root cause: alpha curve was conservative (`dimStrength=0.25`, narrow age/durability attenuation).
- Fix:
  - `/Users/fdasaro/Desktop/Flatlander/src/render/viewModifiers.ts`:
    - stronger age attenuation factor.
    - stronger durability attenuation floor.
  - Defaults increased:
    - `/Users/fdasaro/Desktop/Flatlander/index.html` (`Dim By Age` checked, `Dimming Strength` 0.55).
    - `/Users/fdasaro/Desktop/Flatlander/src/main.ts` (`dimByAge=true`, `dimStrength=0.55`).

3. **Potential race-like inconsistency in fog preview**
- Root cause: renderer still read `world.config.fog*` directly for fog preview rings/field, bypassing frame snapshot.
- Fix:
  - `/Users/fdasaro/Desktop/Flatlander/src/ui/frameSnapshot.ts` now captures `fogMinIntensity` + `fogMaxDistance`.
  - `/Users/fdasaro/Desktop/Flatlander/src/render/canvasRenderer.ts` fog preview paths now consume snapshot values only.

4. **Flatlander “Fog Density” control felt redundant**
- Root cause: 1D view fog density was overwritten entirely by local field density.
- Fix:
  - `/Users/fdasaro/Desktop/Flatlander/src/main.ts`:
    - effective 1D fog density = user fog scale × (local fog / global base fog).
    - preserves user control while applying spatial fog variation.
  - `/Users/fdasaro/Desktop/Flatlander/index.html` label clarified to **Fog Scale**.

5. **Overlay controls felt noisy / sometimes ineffective**
- Root cause: dependent controls remained enabled even when parent toggles were off.
- Fix:
  - `/Users/fdasaro/Desktop/Flatlander/src/ui/uiController.ts`:
    - added `syncEventHighlightsFieldState` and `syncFlatlanderFieldState`.
    - dependent controls are disabled contextually (talking depends on hearing, network subcontrols depend on network, fog-preview subcontrols depend on fog-preview, dim strength depends on dim toggles, flatlander controls depend on flatlander enabled).
    - environment controls now disable door/occupancy/rain-overlay controls when houses/rain disabled.

6. **Rain-time shelter seeking reliability**
- Verification additions:
  - `/Users/fdasaro/Desktop/Flatlander/tests/rainShelterMajority.test.ts`
  - ensures >=70% of outside social-nav entities select `seekShelter`/`seekHome` under rain in deterministic setup.

## Validation targets used
- `npm test`
- `npm run lint`
- `npm run build`
