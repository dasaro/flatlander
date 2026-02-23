import type { VoiceComponent, VoiceSignature } from './components';
import { Rank } from './rank';
import type { ShapeComponent } from './shapes';

export function defaultVoiceSignatureForShape(shape: ShapeComponent, rank: Rank): VoiceSignature {
  if (shape.kind === 'segment') {
    return 'WomanCry';
  }

  if (shape.kind === 'polygon' && shape.sides === 4) {
    return 'Square';
  }

  if (shape.kind === 'polygon' && shape.sides === 5) {
    return 'Pentagon';
  }

  if (rank === Rank.Triangle) {
    return 'Equilateral';
  }

  return 'HighOrder';
}

export function defaultVoiceComponent(shape: ShapeComponent, rank: Rank): VoiceComponent {
  const isIsoscelesTriangle =
    shape.kind === 'polygon' && shape.sides === 3 && shape.triangleKind === 'Isosceles';
  return {
    signature: defaultVoiceSignatureForShape(shape, rank),
    mimicryEnabled: false,
    mimicrySignature: isIsoscelesTriangle ? 'Square' : null,
  };
}
