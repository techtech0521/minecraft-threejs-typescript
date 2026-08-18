export const WORLD_SIZE = 28;
export const WATER_LEVEL = 4;

export type BlockId = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const BLOCKS = [
  { id: 1 as BlockId, name: 'Grass', color: 0x70a840, css: '#70a840' },
  { id: 2 as BlockId, name: 'Dirt', color: 0x765239, css: '#765239' },
  { id: 3 as BlockId, name: 'Stone', color: 0x858788, css: '#858788' },
  { id: 4 as BlockId, name: 'Sand', color: 0xd8c486, css: '#d8c486' },
  { id: 5 as BlockId, name: 'Wood', color: 0x77502f, css: '#77502f' },
  { id: 6 as BlockId, name: 'Leaves', color: 0x3d813d, css: '#3d813d' },
] as const;

export const keyOf = (x: number, y: number, z: number) => `${x},${y},${z}`;

function noise(x: number, z: number, seed: number): number {
  const v = Math.sin(x * 12.9898 + z * 78.233 + seed * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

export function terrainHeight(x: number, z: number, seed: number): number {
  const rolling = Math.sin((x + seed) * 0.25) * 1.6 + Math.cos((z - seed) * 0.22) * 1.3;
  return Math.max(2, Math.floor(5 + rolling + noise(x >> 1, z >> 1, seed) * 1.4));
}

export function generateWorld(seed: number): Map<string, BlockId> {
  const world = new Map<string, BlockId>();
  const half = WORLD_SIZE / 2;
  for (let x = -half; x < half; x++) {
    for (let z = -half; z < half; z++) {
      const height = terrainHeight(x, z, seed);
      for (let y = 0; y <= height; y++) {
        const id: BlockId = y === height ? (height <= WATER_LEVEL ? 4 : 1) : y > height - 3 ? 2 : 3;
        world.set(keyOf(x, y, z), id);
      }
      const tree = noise(x, z, seed + 42) > 0.965 && height > WATER_LEVEL + 1 && Math.abs(x) > 2;
      if (tree) {
        for (let y = height + 1; y <= height + 3; y++) world.set(keyOf(x, y, z), 5);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
          for (let dy = 3; dy <= 4; dy++) world.set(keyOf(x + dx, height + dy, z + dz), 6);
        }
        world.set(keyOf(x, height + 5, z), 6);
      }
    }
  }
  return world;
}
