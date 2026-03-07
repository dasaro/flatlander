export class MobileMenuState {
  private mobileOpen = false;
  private desktopExpanded = true;

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
      if (this.isMobileViewport()) {
        this.toggleMobile();
      } else {
        this.toggleDesktop();
      }
    });

    this.backdrop.addEventListener('click', () => {
      this.closeMobile();
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.closeMobile();
      }
    });

    const matchMedia = (globalThis as { matchMedia?: (query: string) => MediaQueryList }).matchMedia;
    if (typeof matchMedia === 'function') {
      const media = matchMedia('(max-width: 900px)');
      media.addEventListener('change', () => {
        if (!this.isMobileViewport()) {
          this.closeMobile();
        }
        this.syncState();
      });
    }
  }

  open(): void {
    if (this.isMobileViewport()) {
      this.mobileOpen = true;
      this.syncState();
      return;
    }
    this.desktopExpanded = true;
    this.syncState();
  }

  close(): void {
    if (this.isMobileViewport()) {
      this.closeMobile();
      return;
    }
    this.desktopExpanded = false;
    this.syncState();
  }

  toggle(): void {
    if (this.isMobileViewport()) {
      this.toggleMobile();
    } else {
      this.toggleDesktop();
    }
  }

  get opened(): boolean {
    return this.isMobileViewport() ? this.mobileOpen : this.desktopExpanded;
  }

  private toggleMobile(): void {
    this.mobileOpen = !this.mobileOpen;
    this.syncState();
  }

  private toggleDesktop(): void {
    this.desktopExpanded = !this.desktopExpanded;
    this.syncState();
  }

  private closeMobile(): void {
    if (!this.mobileOpen) {
      return;
    }
    this.mobileOpen = false;
    this.syncState();
  }

  private syncState(): void {
    document.body.classList.toggle('menu-open', this.mobileOpen);
    document.body.classList.toggle('sidebar-collapsed', !this.isMobileViewport() && !this.desktopExpanded);
    this.syncAria();
  }

  private syncAria(): void {
    const expanded = this.isMobileViewport() ? this.mobileOpen : this.desktopExpanded;
    this.toggleButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    this.backdrop.setAttribute('aria-hidden', this.mobileOpen ? 'false' : 'true');
  }
}
