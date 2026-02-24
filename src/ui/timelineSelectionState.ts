export function getNearestEventfulIndexAtX(
  x: number,
  width: number,
  eventfulCount: number,
): number | null {
  if (eventfulCount <= 0 || width <= 0) {
    return null;
  }
  if (eventfulCount === 1) {
    return 0;
  }

  const clampedX = Math.max(0, Math.min(width, x));
  const normalized = clampedX / width;
  const index = Math.round(normalized * (eventfulCount - 1));
  return Math.max(0, Math.min(eventfulCount - 1, index));
}

export class TimelineSelectionState {
  hoveredIndex: number | null = null;
  pinnedIndex: number | null = null;

  get effectiveIndex(): number | null {
    return this.pinnedIndex ?? this.hoveredIndex;
  }

  setHovered(index: number | null): void {
    this.hoveredIndex = index;
  }

  togglePinned(index: number | null): void {
    if (index === null) {
      this.pinnedIndex = null;
      return;
    }
    this.pinnedIndex = this.pinnedIndex === index ? null : index;
  }

  clearPin(): void {
    this.pinnedIndex = null;
  }
}
