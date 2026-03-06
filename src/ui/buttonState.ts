type SupportedControl = HTMLButtonElement | HTMLInputElement | HTMLSelectElement;

export function setControlEnabled(
  control: SupportedControl,
  enabled: boolean,
  disabledReason?: string,
  enabledHint?: string,
): void {
  control.disabled = !enabled;
  control.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  control.title = enabled ? enabledHint ?? '' : disabledReason ?? 'Unavailable';
}

export function setControlHint(control: SupportedControl, hint: string): void {
  if (control.disabled) {
    return;
  }
  control.title = hint;
}

export function setButtonEnabled(
  button: HTMLButtonElement,
  enabled: boolean,
  disabledReason?: string,
  enabledHint?: string,
): void {
  setControlEnabled(button, enabled, disabledReason, enabledHint);
}
