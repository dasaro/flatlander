export interface EntityStrokeStyleInput {
  fillColor: string;
  pregnantFillColor?: string | null;
  strokeByKills: boolean;
  killStrokeColor: string;
  allowColor: boolean;
  paintStrokeColor?: string | null;
  isSelected: boolean;
  isHovered: boolean;
}

const DEFAULT_SELECTED_STROKE = '#111111';
const DEFAULT_HOVER_STROKE = '#d88a1f';
const DEFAULT_FALLBACK_STROKE = '#232323';

export function deriveOutlineColor(fillColor: string): string {
  const rgb = parseHexColor(fillColor);
  if (!rgb) {
    return DEFAULT_FALLBACK_STROKE;
  }

  const factor = 0.62;
  return formatHexColor({
    r: Math.round(rgb.r * factor),
    g: Math.round(rgb.g * factor),
    b: Math.round(rgb.b * factor),
  });
}

export function resolveEntityStrokeColor(input: EntityStrokeStyleInput): string {
  if (input.isSelected) {
    return DEFAULT_SELECTED_STROKE;
  }
  if (input.isHovered) {
    return DEFAULT_HOVER_STROKE;
  }
  if (input.strokeByKills) {
    return input.killStrokeColor;
  }
  if (input.allowColor && input.paintStrokeColor) {
    return input.paintStrokeColor;
  }

  const source = input.pregnantFillColor ?? input.fillColor;
  return deriveOutlineColor(source);
}

function parseHexColor(color: string): { r: number; g: number; b: number } | null {
  const trimmed = color.trim();
  const match = /^#([0-9a-f]{6})$/i.exec(trimmed);
  if (!match) {
    return null;
  }

  const hex = match[1]!;
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function formatHexColor(color: { r: number; g: number; b: number }): string {
  const toHex = (value: number): string => clampByte(value).toString(16).padStart(2, '0');
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, value));
}
