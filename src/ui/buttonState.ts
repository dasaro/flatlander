export function setButtonEnabled(
  button: HTMLButtonElement,
  enabled: boolean,
  disabledReason?: string,
): void {
  button.disabled = !enabled;
  button.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  button.title = enabled ? '' : disabledReason ?? 'Unavailable';
}
