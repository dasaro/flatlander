import { describe, expect, it } from 'vitest';

import { applyInspectorActionButtonState } from '../src/ui/uiController';

function mockButton(): HTMLButtonElement {
  const attributes = new Map<string, string>();
  const button = {
    disabled: false,
    title: '',
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
    getAttribute(name: string) {
      return attributes.get(name) ?? null;
    },
  };
  return button as unknown as HTMLButtonElement;
}

describe('inspector action buttons', () => {
  it('disables selection-dependent buttons with reason when nothing is selected', () => {
    const introductionButton = mockButton();
    const manualHaltButton = mockButton();

    applyInspectorActionButtonState(
      {
        introductionButton,
        manualHaltButton,
      },
      null,
    );

    expect(introductionButton.disabled).toBe(true);
    expect(manualHaltButton.disabled).toBe(true);
    expect(introductionButton.title).toContain('Select an entity');
    expect(manualHaltButton.title).toContain('Select an entity');
    expect(introductionButton.getAttribute('aria-disabled')).toBe('true');
  });

  it('enables buttons when there is a selected entity', () => {
    const introductionButton = mockButton();
    const manualHaltButton = mockButton();

    applyInspectorActionButtonState(
      {
        introductionButton,
        manualHaltButton,
      },
      42,
    );

    expect(introductionButton.disabled).toBe(false);
    expect(manualHaltButton.disabled).toBe(false);
    expect(introductionButton.title).toBe('');
    expect(manualHaltButton.title).toBe('');
    expect(introductionButton.getAttribute('aria-disabled')).toBe('false');
  });
});
