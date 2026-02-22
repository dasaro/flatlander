export type SelectionListener = (selectedId: number | null) => void;

export interface SelectionUpdateOptions {
  forceNotify?: boolean;
}

export class SelectionState {
  private selectedIdValue: number | null = null;
  private readonly listeners = new Set<SelectionListener>();

  get selectedId(): number | null {
    return this.selectedIdValue;
  }

  setSelected(selectedId: number | null, options: SelectionUpdateOptions = {}): void {
    const unchanged = this.selectedIdValue === selectedId;
    if (unchanged && !options.forceNotify) {
      return;
    }

    this.selectedIdValue = selectedId;
    for (const listener of this.listeners) {
      listener(selectedId);
    }
  }

  subscribe(listener: SelectionListener): () => void {
    this.listeners.add(listener);
    listener(this.selectedIdValue);

    return () => {
      this.listeners.delete(listener);
    };
  }
}
