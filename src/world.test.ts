import { describe, expect, it } from 'vitest';
import { generateWorld, keyOf, terrainHeight } from './world';

describe('world generation', () => {
  it('is deterministic for a given seed', () => {
    expect(terrainHeight(5, -2, 42)).toBe(terrainHeight(5, -2, 42));
    expect([...generateWorld(7)]).toEqual([...generateWorld(7)]);
  });
  it('creates a solid surface at the origin', () => {
    const world = generateWorld(12);
    expect(world.get(keyOf(0, terrainHeight(0, 0, 12), 0))).toBeTruthy();
  });
});
