import { describe, expect, it } from 'vitest';

import { deriveOutlineColor, resolveEntityStrokeColor } from '../src/render/entityStyle';

describe('entityStyle', () => {
  it('derives a darker outline from the fill color instead of defaulting to black', () => {
    expect(deriveOutlineColor('#5984b3')).toBe('#37526f');
    expect(deriveOutlineColor('#3aa17e')).toBe('#24644e');
    expect(deriveOutlineColor('#d94f3d')).toBe('#873126');
  });

  it('uses uniform rank-derived outlines unless selection, hover, or kill styling overrides them', () => {
    const ordinary = resolveEntityStrokeColor({
      fillColor: '#5984b3',
      pregnantFillColor: null,
      strokeByKills: false,
      killStrokeColor: '#6c4a2c',
      isSelected: false,
      isHovered: false,
    });
    const selected = resolveEntityStrokeColor({
      fillColor: '#5984b3',
      pregnantFillColor: null,
      strokeByKills: false,
      killStrokeColor: '#6c4a2c',
      isSelected: true,
      isHovered: false,
    });
    const hovered = resolveEntityStrokeColor({
      fillColor: '#5984b3',
      pregnantFillColor: null,
      strokeByKills: false,
      killStrokeColor: '#6c4a2c',
      isSelected: false,
      isHovered: true,
    });
    const killStyled = resolveEntityStrokeColor({
      fillColor: '#5984b3',
      pregnantFillColor: null,
      strokeByKills: true,
      killStrokeColor: '#6c4a2c',
      isSelected: false,
      isHovered: false,
    });

    expect(ordinary).toBe('#37526f');
    expect(selected).toBe('#111111');
    expect(hovered).toBe('#d88a1f');
    expect(killStyled).toBe('#6c4a2c');
  });
});
