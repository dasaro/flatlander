export class MobileMenuState {
  private isOpen = false;

  constructor(
    private readonly toggleButton: HTMLButtonElement,
    private readonly sidebar: HTMLElement,
    private readonly backdrop: HTMLElement,
    private readonly isMobileViewport: () => boolean = () => window.matchMedia('(max-width: 900px)').matches,
  ) {
    this.toggleButton.setAttribute('aria-controls', this.sidebar.id);
    this.syncAria();
  }

  bind(): void {
    this.toggleButton.addEventListener('click', () => {
      if (!this.isMobileViewport()) {
        return;
      }
      this.toggle();
    });

    this.backdrop.addEventListener('click', () => {
      this.close();
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.close();
      }
    });

    const matchMedia = (globalThis as { matchMedia?: (query: string) => MediaQueryList }).matchMedia;
    if (typeof matchMedia === 'function') {
      const media = matchMedia('(max-width: 900px)');
      media.addEventListener('change', () => {
        if (!this.isMobileViewport()) {
          this.close();
        }
      });
    }
  }

  open(): void {
    if (!this.isMobileViewport()) {
      return;
    }
    this.isOpen = true;
    document.body.classList.add('menu-open');
    this.syncAria();
  }

  close(): void {
    this.isOpen = false;
    document.body.classList.remove('menu-open');
    this.syncAria();
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
      return;
    }
    this.open();
  }

  get opened(): boolean {
    return this.isOpen;
  }

  private syncAria(): void {
    this.toggleButton.setAttribute('aria-expanded', this.isOpen ? 'true' : 'false');
    this.backdrop.setAttribute('aria-hidden', this.isOpen ? 'false' : 'true');
  }
}
