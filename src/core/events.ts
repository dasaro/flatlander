export type EventHandler<T> = (payload: T) => void;

export class EventBus<Events extends object> {
  private handlers = new Map<keyof Events, Set<EventHandler<unknown>>>();

  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    const existing = this.handlers.get(event);
    const typedHandler = handler as EventHandler<unknown>;

    if (existing) {
      existing.add(typedHandler);
    } else {
      this.handlers.set(event, new Set([typedHandler]));
    }

    return () => {
      this.off(event, handler);
    };
  }

  off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    const existing = this.handlers.get(event);
    if (!existing) {
      return;
    }

    existing.delete(handler as EventHandler<unknown>);
    if (existing.size === 0) {
      this.handlers.delete(event);
    }
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const existing = this.handlers.get(event);
    if (!existing) {
      return;
    }

    for (const handler of existing) {
      handler(payload);
    }
  }
}
