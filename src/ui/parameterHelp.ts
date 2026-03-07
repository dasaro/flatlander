const EXPLICIT_HELP: Record<string, string> = {
  'seed-input': 'Sets the deterministic world seed used for the simulation and all seeded headless behavior.',
  'world-topology': 'Chooses whether the world wraps like a torus or has hard outer boundaries.',
  'speed-select': 'Changes wall-clock playback speed without changing fixed-tick simulation determinism.',

  'south-enabled': 'Turns the south-attraction field on or off.',
  'south-strength': 'Sets how strongly the south-attraction field pulls entities downward.',
  'south-women-multiplier': 'Scales south-attraction strength for segments.',
  'south-zone-start': 'Sets where the stronger southern band begins, as a fraction of world height.',
  'south-zone-end': 'Sets where the stronger southern band reaches its maximum extent.',
  'south-drag': 'Controls how quickly south-attraction drift settles toward its terminal speed.',
  'south-max-terminal': 'Caps the maximum downward drift speed caused by south-attraction.',
  'south-escape-fraction': 'Limits south drift relative to self-propulsion so northward escape remains possible.',
  'south-show-zone': 'Shows the southern danger zone overlay in God-view.',
  'south-show-click-debug': 'Shows click-debug markers for the south field overlay.',

  'event-highlights-enabled': 'Enables renderer-side interaction overlays and related display options.',
  'event-highlights-show-legend': 'Shows or hides the dynamic legend for currently active overlays and events.',
  'event-highlights-intensity': 'Scales the brightness and prominence of interaction highlights.',
  'event-highlights-cap': 'Limits how many highlight effects can be shown per tick.',
  'event-show-feeling': 'Shows touch, handshake, and stillness-feeling cues.',
  'event-stroke-kills': 'Colors shape outlines by kill count instead of using only rank styling.',
  'overlay-network-parents': 'Shows parent links in the contact-network overlay.',
  'overlay-network-known': 'Shows known-contact links in the contact-network overlay.',
  'overlay-network-max-known': 'Limits how many known-contact links are drawn for the selected entity.',
  'overlay-network-on-screen': 'Restricts contact-network links to targets that are currently on screen.',
  'overlay-network-focus-radius': 'Limits contact-network links to a world-space radius around the selected entity.',
  'overlay-dim-age': 'Dims entities gradually as they age.',
  'overlay-dim-deterioration': 'Dims entities as HP declines.',
  'overlay-dim-strength': 'Controls how strongly age and HP dimming affect the rendered alpha.',
  'overlay-show-eyes': 'Draws the perimeter eye point in God-view.',

  'flatlander-enabled': 'Shows the 1D Flatlander point-of-view panel for the selected entity.',
  'flatlander-rays': 'Sets the number of scan rays used for the 1D view.',
  'flatlander-fov': 'Sets the selected observer’s displayed field of view in the 1D panel.',
  'flatlander-look-offset': 'Rotates the rendered 1D view without changing simulation behavior.',
  'flatlander-max-distance': 'Caps how far the 1D scan looks from the selected eye.',
  'flatlander-fog-density': 'Sets the 1D view fog strength used for dimness in the retina strip.',
  'flatlander-include-obstacles': 'Includes inanimate obstacles and houses in the 1D scan.',
  'flatlander-grayscale': 'Switches the 1D view between grayscale and color coding.',

  'fog-sight-enabled': 'Enables headless sight recognition behavior in the simulation.',
  'fog-sight-density': 'Sets the global base fog density used by sight recognition and fog fields.',

  'env-houses-enabled': 'Turns house generation and house-based shelter behavior on or off.',
  'env-house-count': 'Sets how many houses are generated when the world is reset.',
  'env-town-population': 'Sets the notional town size used by house-generation rules and restrictions.',
  'env-allow-triangular-forts': 'Allows rare triangular fort-like structures during house generation.',
  'env-allow-square-houses': 'Allows square houses when the town-population restriction permits them.',
  'env-house-size': 'Sets the base generated house size on reset.',
  'env-rain-enabled': 'Turns the headless rain schedule on or off.',
  'env-show-rain-overlay': 'Shows the God-view rain overlay.',
  'env-show-fog-overlay': 'Shows the God-view fog field overlay.',
  'env-show-house-doors': 'Draws door markers on houses in God-view.',
  'env-show-house-occupancy': 'Shows current occupancy counts on houses in God-view.',
  'env-show-housing-debug': 'Shows house-door targeting diagnostics for selected shelter seekers.',

  'peace-cry-enabled': 'Sets the default peace-cry behavior used for segments.',
  'peace-cry-cadence': 'Sets how often default peace-cry emits.',
  'peace-cry-radius': 'Sets the default peace-cry hearing radius.',
  'peace-cry-strict-compliance': 'Requires strict halt/compliance responses to peace-cry.',
  'peace-cry-compliance-stillness': 'Sets how long cry-compliance halts last.',
  'peace-cry-north-yield-enabled': 'Enables north-yield etiquette responses to nearby cries.',
  'peace-cry-north-yield-radius': 'Sets the radius within which north-yield etiquette can trigger.',
  'peace-cry-rain-curfew-enabled': 'Enables rain curfew behavior for segments.',
  'peace-cry-rain-curfew-grace': 'Sets how long outside segments may remain exposed before curfew pressure escalates.',

  'reproduction-enabled': 'Turns reproduction on or off.',
  'reproduction-gestation-ticks': 'Sets pregnancy duration in simulation ticks.',
  'reproduction-mating-radius': 'Sets how close bonded partners must be for conception checks.',
  'reproduction-conception-chance': 'Sets the per-tick conception chance once domestic conditions are satisfied.',
  'reproduction-female-birth-probability': 'Sets the probability that a newborn is a segment rather than a polygon/circle.',
  'reproduction-max-population': 'Soft population ceiling used by reproduction gating.',
  'reproduction-irregular-enabled': 'Allows irregular births in the reproduction model.',
  'reproduction-irregular-base-chance': 'Sets the base chance for irregular births when enabled.',
  'reproduction-priest-mediation-enabled': 'Enables priest mediation in partner selection and rank persistence.',
  'reproduction-priest-mediation-radius': 'Sets how close a priest must be to influence mediation.',
  'reproduction-priest-mediation-bias': 'Sets how strongly priest mediation biases partner choice.',

  'spawn-shape': 'Chooses which kind of entity the Spawn action creates.',
  'spawn-sides': 'Sets the number of polygon sides for spawned regular or irregular polygons.',
  'spawn-irregular': 'Marks newly spawned polygons as irregular.',
  'spawn-triangle-kind': 'Chooses whether a spawned triangle is equilateral or isosceles.',
  'spawn-base-ratio': 'Sets the isosceles base ratio used to derive its acute brain angle.',
  'spawn-size': 'Sets the base world-space size of the spawned entity.',
  'spawn-count': 'Spawns this many copies of the configured entity.',
  'spawn-movement-type': 'Chooses the initial movement controller for spawned entities.',
  'spawn-speed': 'Sets the initial cruising speed or max speed for spawned movement.',
  'spawn-turn-rate': 'Sets how quickly the spawned entity can turn.',
  'spawn-decision-ticks': 'Sets how often social-nav updates its intention.',
  'spawn-intention-min-ticks': 'Sets the minimum time a social-nav intention is held before reconsideration.',
  'spawn-vx': 'Sets the initial X drift velocity for straight-drift spawns.',
  'spawn-vy': 'Sets the initial Y drift velocity for straight-drift spawns.',
  'spawn-target-x': 'Sets the target X position for seek-point movement.',
  'spawn-target-y': 'Sets the target Y position for seek-point movement.',
  'spawn-feeling-enabled': 'Enables feeling and handshake behavior for spawned entities.',
  'spawn-feel-cooldown': 'Sets the cooldown between feeling attempts for spawned entities.',
  'spawn-approach-speed': 'Sets the slow approach speed used for tactile introductions.',
  'spawn-female-rank': 'Sets the social rank used for spawned segments.',
  'spawn-mimicry-enabled': 'Enables voice imposture for spawned isosceles triangles.',
  'spawn-mimicry-signature': 'Chooses which voice signature an impostor claims.',

  'inspector-movement-type': 'Changes the selected entity’s movement controller.',
  'inspector-vision-enabled': 'Turns the selected entity’s sight behavior on or off.',
  'inspector-vision-range': 'Sets how far the selected entity can sight-check hazards.',
  'inspector-avoid-distance': 'Sets how early the selected entity begins avoidance steering.',
  'inspector-hearing-skill': 'Sets how effectively the selected entity reacts to heard signals.',
  'inspector-hearing-radius': 'Sets the hearing radius for the selected entity.',
  'inspector-eye-fov': 'Sets the selected entity’s personal field of view.',
  'inspector-feeling-enabled': 'Turns tactile introductions on or off for the selected entity.',
  'inspector-feel-cooldown': 'Sets the selected entity’s cooldown between feeling attempts.',
  'inspector-approach-speed': 'Sets the selected entity’s careful speed while approaching to feel.',
  'inspector-peace-cry-enabled': 'Turns peace-cry on or off for the selected segment.',
  'inspector-peace-cry-cadence': 'Sets the cry cadence for the selected segment.',
  'inspector-peace-cry-radius': 'Sets the cry radius for the selected segment.',
  'inspector-speed': 'Sets the selected entity’s speed or max speed, depending on movement type.',
  'inspector-turn-rate': 'Sets the selected entity’s turn rate.',
  'inspector-decision-ticks': 'Sets how often the selected social-nav entity reconsiders its intention.',
  'inspector-intention-min-ticks': 'Sets how long the selected social-nav entity tends to hold an intention.',
  'inspector-vx': 'Sets the selected straight-drift entity’s X velocity.',
  'inspector-vy': 'Sets the selected straight-drift entity’s Y velocity.',
  'inspector-target-x': 'Sets the selected seek-point entity’s target X position.',
  'inspector-target-y': 'Sets the selected seek-point entity’s target Y position.',
  'inspector-voice-enabled': 'Turns voice imposture on or off for the selected isosceles triangle.',
  'inspector-voice-signature': 'Sets the claimed voice signature for the selected impostor.',
};

function resolveHelpText(controlId: string, labelText: string, panelTitle: string): string {
  const explicit = EXPLICIT_HELP[controlId];
  if (explicit) {
    return explicit;
  }
  if (controlId.startsWith('timeline-type-')) {
    return 'Shows or hides this event row in the timeline.';
  }
  if (controlId.startsWith('timeline-')) {
    return 'Controls how the event timeline is filtered or grouped.';
  }
  const parameter = labelText.trim().replace(/\s+/g, ' ').toLowerCase();
  const panel = panelTitle.trim().replace(/\s+/g, ' ').toLowerCase();
  return `Controls ${parameter} in the ${panel} panel.`;
}

function findAnchor(root: ParentNode, control: HTMLElement): HTMLElement | null {
  const id = control.id;
  const direct = root.querySelector(`label[for="${id}"]`);
  if (direct instanceof HTMLElement) {
    return direct;
  }
  const wrappingLabel = control.closest('label');
  if (wrappingLabel instanceof HTMLElement) {
    return wrappingLabel;
  }
  const row = control.closest('.row');
  if (!row) {
    return null;
  }
  const labelLike = row.querySelector(':scope > label, :scope > span');
  return labelLike instanceof HTMLElement ? labelLike : null;
}

function panelTitleFor(control: HTMLElement): string {
  const panel = control.closest('.panel, .timeline-panel');
  const title = panel?.querySelector('h2, summary');
  return title?.textContent?.trim() || 'controls';
}

function labelTextFor(anchor: HTMLElement): string {
  const clone = anchor.cloneNode(true) as HTMLElement;
  for (const badge of clone.querySelectorAll('.help-badge')) {
    badge.remove();
  }
  const text = clone.textContent?.trim();
  return text && text.length > 0 ? text : 'this setting';
}

export function installParameterHelp(root: ParentNode = document): void {
  const doc = root instanceof Document ? root : root.ownerDocument ?? document;
  const controls = root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
    'input[id], select[id], input[data-rank-filter]',
  );
  for (const control of controls) {
    const anchor = findAnchor(root, control);
    if (!anchor || anchor.querySelector('.help-badge')) {
      continue;
    }
    const syntheticId = control.id || control.getAttribute('data-rank-filter') || '';
    const helpText = resolveHelpText(syntheticId, labelTextFor(anchor), panelTitleFor(control));
    if (!helpText) {
      continue;
    }
    const badge = doc.createElement('span');
    badge.className = 'help-badge';
    badge.textContent = '?';
    badge.title = helpText;
    badge.setAttribute('aria-label', helpText);
    badge.setAttribute('role', 'img');
    anchor.appendChild(badge);
  }
}
