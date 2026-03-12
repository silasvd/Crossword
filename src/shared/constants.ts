import type { BonusType } from './types';

export const BOARD_SIZE = 15;
export const RACK_SIZE = 7;
export const BINGO_BONUS = 50;
export const CENTER = { x: 7, y: 7 };

export const TW_POSITIONS: [number, number][] = [
  [0,0],[0,7],[0,14],[7,0],[7,14],[14,0],[14,7],[14,14]
];

export const DW_POSITIONS: [number, number][] = [
  [1,1],[2,2],[3,3],[4,4],[7,7],[10,10],[11,11],[12,12],[13,13],
  [1,13],[2,12],[3,11],[4,10],[10,4],[11,3],[12,2],[13,1]
];

export const TL_POSITIONS: [number, number][] = [
  [1,5],[1,9],[5,1],[5,5],[5,9],[5,13],[9,1],[9,5],[9,9],[9,13],[13,5],[13,9]
];

export const DL_POSITIONS: [number, number][] = [
  [0,3],[0,11],[2,6],[2,8],[3,0],[3,7],[3,14],[6,2],[6,6],[6,8],[6,12],
  [7,3],[7,11],[8,2],[8,6],[8,8],[8,12],[11,0],[11,7],[11,14],[12,6],[12,8],[14,3],[14,11]
];

export function getBonusAt(row: number, col: number): BonusType {
  if (TW_POSITIONS.some(([r, c]) => r === row && c === col)) return 'TW';
  if (DW_POSITIONS.some(([r, c]) => r === row && c === col)) return 'DW';
  if (TL_POSITIONS.some(([r, c]) => r === row && c === col)) return 'TL';
  if (DL_POSITIONS.some(([r, c]) => r === row && c === col)) return 'DL';
  return null;
}

export const LETTER_DISTRIBUTION: { letter: string; count: number; value: number }[] = [
  { letter: 'A', count: 5, value: 1 },
  { letter: 'B', count: 2, value: 3 },
  { letter: 'C', count: 2, value: 4 },
  { letter: 'D', count: 4, value: 1 },
  { letter: 'E', count: 15, value: 1 },
  { letter: 'F', count: 2, value: 4 },
  { letter: 'G', count: 3, value: 2 },
  { letter: 'H', count: 4, value: 2 },
  { letter: 'I', count: 6, value: 1 },
  { letter: 'J', count: 1, value: 6 },
  { letter: 'K', count: 2, value: 4 },
  { letter: 'L', count: 3, value: 2 },
  { letter: 'M', count: 4, value: 3 },
  { letter: 'N', count: 9, value: 1 },
  { letter: 'O', count: 3, value: 2 },
  { letter: 'P', count: 1, value: 4 },
  { letter: 'Q', count: 1, value: 10 },
  { letter: 'R', count: 6, value: 1 },
  { letter: 'S', count: 7, value: 1 },
  { letter: 'T', count: 6, value: 1 },
  { letter: 'U', count: 6, value: 1 },
  { letter: 'V', count: 1, value: 6 },
  { letter: 'W', count: 1, value: 3 },
  { letter: 'X', count: 1, value: 8 },
  { letter: 'Y', count: 1, value: 10 },
  { letter: 'Z', count: 1, value: 3 },
  { letter: 'Ä', count: 1, value: 6 },
  { letter: 'Ö', count: 1, value: 8 },
  { letter: 'Ü', count: 1, value: 6 },
  { letter: '', count: 2, value: 0 },
];

export const LETTER_VALUES: Record<string, number> = {};
for (const { letter, value } of LETTER_DISTRIBUTION) {
  LETTER_VALUES[letter] = value;
}

export function createBag(): import('./types').Tile[] {
  const tiles: import('./types').Tile[] = [];
  let idCounter = 0;
  for (const { letter, count, value } of LETTER_DISTRIBUTION) {
    for (let i = 0; i < count; i++) {
      tiles.push({
        id: `tile-${idCounter++}`,
        letter,
        value,
        isBlank: letter === '',
      });
    }
  }
  return tiles;
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateId(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}
