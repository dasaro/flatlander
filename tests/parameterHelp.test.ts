/* @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';

import { installParameterHelp } from '../src/ui/parameterHelp';

describe('parameter help badges', () => {
  it('adds a help badge to labelled controls with explicit help', () => {
    document.body.innerHTML = `
      <section class="panel">
        <h2>Simulation</h2>
        <div class="row">
          <label for="seed-input">Seed</label>
          <input id="seed-input" type="number" />
        </div>
      </section>
    `;

    installParameterHelp(document);

    const label = document.querySelector('label[for="seed-input"]');
    const badge = label?.querySelector('.help-badge');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('title')).toContain('deterministic world seed');
  });

  it('falls back to a generic help description when no explicit mapping exists', () => {
    document.body.innerHTML = `
      <section class="panel">
        <h2>Custom Panel</h2>
        <div class="row">
          <label for="custom-setting">Custom Setting</label>
          <input id="custom-setting" type="number" />
        </div>
      </section>
    `;

    installParameterHelp(document);

    const badge = document.querySelector('label[for="custom-setting"] .help-badge');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('title')).toContain('custom setting');
    expect(badge?.getAttribute('title')).toContain('custom panel');
  });
});
