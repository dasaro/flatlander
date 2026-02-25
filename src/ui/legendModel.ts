import type { EventType } from './eventAnalytics';

export interface LegendVisibilityState {
  eventHighlightsEnabled: boolean;
  showFeeling: boolean;
  showHearingOverlay: boolean;
  showContactNetwork: boolean;
  showNetworkParents: boolean;
  showNetworkKnown: boolean;
  observedEventTypes: Set<EventType>;
  hasSelectedEntity: boolean;
  hasAnyStillness: boolean;
}

export interface LegendItem {
  id: string;
  label: string;
  isVisible: (state: LegendVisibilityState) => boolean;
  drawIcon: (ctx: CanvasRenderingContext2D, size: number) => void;
}

function eventVisible(
  type: EventType,
  state: LegendVisibilityState,
  includeFeelingToggle = false,
): boolean {
  if (!state.eventHighlightsEnabled || !state.observedEventTypes.has(type)) {
    return false;
  }
  if (includeFeelingToggle && !state.showFeeling) {
    return false;
  }
  return true;
}

const LEGEND_ITEMS: LegendItem[] = [
  {
    id: 'touch',
    label: 'Touch (feeling)',
    isVisible: (state) => eventVisible('touch', state, true),
    drawIcon: (ctx, size) => {
      const c = size / 2;
      const r = size * 0.12;
      ctx.fillStyle = '#c99d4c';
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(201,157,76,0.65)';
      ctx.lineWidth = Math.max(1, size * 0.08);
      ctx.beginPath();
      ctx.arc(c, c, size * 0.28, 0, Math.PI * 2);
      ctx.stroke();
    },
  },
  {
    id: 'handshakeStart',
    label: 'Handshake Start',
    isVisible: (state) => eventVisible('handshakeStart', state, true),
    drawIcon: (ctx, size) => {
      const c = size / 2;
      ctx.fillStyle = '#5f9aa2';
      ctx.beginPath();
      ctx.arc(c, c, size * 0.14, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'handshake',
    label: 'Handshake (recognized)',
    isVisible: (state) => eventVisible('handshake', state, true),
    drawIcon: (ctx, size) => {
      const top = size * 0.25;
      const bottom = size * 0.75;
      ctx.strokeStyle = '#2c2a24';
      ctx.lineWidth = Math.max(1, size * 0.08);
      ctx.beginPath();
      ctx.moveTo(size * 0.35, top);
      ctx.lineTo(size * 0.35, bottom);
      ctx.moveTo(size * 0.65, top);
      ctx.lineTo(size * 0.65, bottom);
      ctx.stroke();
    },
  },
  {
    id: 'peaceCry',
    label: 'Peace-cry',
    isVisible: (state) => eventVisible('peaceCry', state),
    drawIcon: (ctx, size) => {
      ctx.strokeStyle = '#3a678c';
      ctx.lineWidth = Math.max(1, size * 0.07);
      ctx.setLineDash([size * 0.12, size * 0.1]);
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    },
  },
  {
    id: 'stab',
    label: 'Stab',
    isVisible: (state) => eventVisible('stab', state),
    drawIcon: (ctx, size) => {
      const c = size / 2;
      const r = size * 0.32;
      ctx.strokeStyle = '#b84040';
      ctx.lineWidth = Math.max(1, size * 0.08);
      ctx.beginPath();
      ctx.moveTo(c, c - r);
      ctx.lineTo(c, c + r);
      ctx.moveTo(c - r * 0.8, c - r * 0.5);
      ctx.lineTo(c + r * 0.8, c + r * 0.5);
      ctx.moveTo(c + r * 0.8, c - r * 0.5);
      ctx.lineTo(c - r * 0.8, c + r * 0.5);
      ctx.stroke();
    },
  },
  {
    id: 'death',
    label: 'Death',
    isVisible: (state) => eventVisible('death', state),
    drawIcon: (ctx, size) => {
      const pad = size * 0.25;
      ctx.strokeStyle = '#2c2a24';
      ctx.lineWidth = Math.max(1, size * 0.1);
      ctx.beginPath();
      ctx.moveTo(pad, pad);
      ctx.lineTo(size - pad, size - pad);
      ctx.moveTo(size - pad, pad);
      ctx.lineTo(pad, size - pad);
      ctx.stroke();
    },
  },
  {
    id: 'birth',
    label: 'Birth',
    isVisible: (state) => eventVisible('birth', state),
    drawIcon: (ctx, size) => {
      const c = size / 2;
      ctx.strokeStyle = '#60845c';
      ctx.lineWidth = Math.max(1, size * 0.07);
      ctx.beginPath();
      ctx.arc(c, c, size * 0.28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#60845c';
      ctx.beginPath();
      ctx.arc(c, c, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'houseEnter',
    label: 'Enter House',
    isVisible: (state) => eventVisible('houseEnter', state),
    drawIcon: (ctx, size) => {
      const c = size / 2;
      const r = size * 0.22;
      ctx.strokeStyle = '#4f7f58';
      ctx.lineWidth = Math.max(1, size * 0.08);
      ctx.beginPath();
      ctx.moveTo(c - r, c);
      ctx.lineTo(c + r * 0.4, c);
      ctx.moveTo(c + r * 0.4, c);
      ctx.lineTo(c + r * 0.05, c - r * 0.35);
      ctx.moveTo(c + r * 0.4, c);
      ctx.lineTo(c + r * 0.05, c + r * 0.35);
      ctx.stroke();
    },
  },
  {
    id: 'houseExit',
    label: 'Exit House',
    isVisible: (state) => eventVisible('houseExit', state),
    drawIcon: (ctx, size) => {
      const c = size / 2;
      const r = size * 0.22;
      ctx.strokeStyle = '#4b6582';
      ctx.lineWidth = Math.max(1, size * 0.08);
      ctx.beginPath();
      ctx.moveTo(c + r, c);
      ctx.lineTo(c - r * 0.4, c);
      ctx.moveTo(c - r * 0.4, c);
      ctx.lineTo(c - r * 0.05, c - r * 0.35);
      ctx.moveTo(c - r * 0.4, c);
      ctx.lineTo(c - r * 0.05, c + r * 0.35);
      ctx.stroke();
    },
  },
  {
    id: 'regularized',
    label: 'Regularized',
    isVisible: (state) => eventVisible('regularized', state),
    drawIcon: (ctx, size) => {
      const c = size / 2;
      const r = size * 0.25;
      ctx.strokeStyle = '#6c57a8';
      ctx.lineWidth = Math.max(1, size * 0.08);
      ctx.beginPath();
      ctx.moveTo(c - r, c);
      ctx.lineTo(c + r, c);
      ctx.moveTo(c, c - r);
      ctx.lineTo(c, c + r);
      ctx.stroke();
    },
  },
  {
    id: 'stillness',
    label: 'Stillness Ring',
    isVisible: (state) =>
      state.eventHighlightsEnabled && state.showFeeling && state.hasAnyStillness,
    drawIcon: (ctx, size) => {
      const c = size / 2;
      ctx.strokeStyle = 'rgba(43,119,96,0.85)';
      ctx.lineWidth = Math.max(1, size * 0.07);
      ctx.setLineDash([size * 0.12, size * 0.1]);
      ctx.beginPath();
      ctx.arc(c, c, size * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    },
  },
  {
    id: 'networkParent',
    label: 'Parent Link (curved)',
    isVisible: (state) =>
      state.showContactNetwork && state.showNetworkParents && state.hasSelectedEntity,
    drawIcon: (ctx, size) => {
      ctx.strokeStyle = 'rgba(49, 92, 170, 0.82)';
      ctx.lineWidth = Math.max(1, size * 0.09);
      ctx.beginPath();
      ctx.moveTo(size * 0.14, size * 0.7);
      ctx.quadraticCurveTo(size * 0.52, size * 0.18, size * 0.86, size * 0.64);
      ctx.stroke();
    },
  },
  {
    id: 'networkKnown',
    label: 'Known Link (curved dotted)',
    isVisible: (state) =>
      state.showContactNetwork && state.showNetworkKnown && state.hasSelectedEntity,
    drawIcon: (ctx, size) => {
      ctx.strokeStyle = 'rgba(121, 80, 150, 0.75)';
      ctx.lineWidth = Math.max(1, size * 0.07);
      ctx.setLineDash([size * 0.1, size * 0.09]);
      ctx.beginPath();
      ctx.moveTo(size * 0.14, size * 0.68);
      ctx.quadraticCurveTo(size * 0.5, size * 0.86, size * 0.86, size * 0.34);
      ctx.stroke();
      ctx.setLineDash([]);
    },
  },
  {
    id: 'hearingLine',
    label: 'Hearing (straight dashed)',
    isVisible: (state) => state.showHearingOverlay && state.hasSelectedEntity,
    drawIcon: (ctx, size) => {
      ctx.strokeStyle = 'rgba(58, 103, 140, 0.8)';
      ctx.lineWidth = Math.max(1, size * 0.07);
      ctx.setLineDash([size * 0.12, size * 0.1]);
      ctx.beginPath();
      ctx.moveTo(size * 0.15, size * 0.7);
      ctx.lineTo(size * 0.85, size * 0.3);
      ctx.stroke();
      ctx.setLineDash([]);
    },
  },
];

export function getVisibleLegendItems(state: LegendVisibilityState): LegendItem[] {
  return LEGEND_ITEMS.filter((item) => item.isVisible(state));
}
