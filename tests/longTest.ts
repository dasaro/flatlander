import { describe } from 'vitest';

export const describeLong = process.env.GITHUB_ACTIONS === 'true' ? describe.skip : describe;
