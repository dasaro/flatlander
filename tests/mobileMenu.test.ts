/* @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';

import { MobileMenuState } from '../src/ui/mobileMenuState';

describe('mobile menu drawer state', () => {
  it('opens on toggle and closes on Escape/backdrop', () => {
    document.body.innerHTML = `
      <button id="toggle"></button>
      <aside id="sidebar"></aside>
      <div id="backdrop"></div>
    `;

    const toggle = document.getElementById('toggle');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('backdrop');
    if (!(toggle instanceof HTMLButtonElement) || !(sidebar instanceof HTMLElement) || !(backdrop instanceof HTMLElement)) {
      throw new Error('Failed to initialize mobile menu test DOM.');
    }

    const menu = new MobileMenuState(toggle, sidebar, backdrop, () => true);
    menu.bind();

    toggle.click();
    expect(document.body.classList.contains('menu-open')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.body.classList.contains('menu-open')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    expect(document.body.classList.contains('menu-open')).toBe(true);
    backdrop.click();
    expect(document.body.classList.contains('menu-open')).toBe(false);
  });
});
