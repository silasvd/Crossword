import type { BoardCell, PlacementInput } from './types';
import { BOARD_SIZE, CENTER } from './constants';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePlacements(
  board: BoardCell[][],
  placements: PlacementInput[],
  isFirstMove: boolean
): ValidationResult {
  if (placements.length === 0) {
    return { valid: false, error: 'Keine Steine gelegt.' };
  }

  const xs = placements.map(p => p.x);
  const ys = placements.map(p => p.y);

  // Check bounds
  for (const p of placements) {
    if (p.x < 0 || p.x >= BOARD_SIZE || p.y < 0 || p.y >= BOARD_SIZE) {
      return { valid: false, error: 'Stein außerhalb des Spielfelds.' };
    }
    if (board[p.y][p.x].tile !== null) {
      return { valid: false, error: 'Feld ist bereits belegt.' };
    }
  }

  // Check unique positions
  const posSet = new Set(placements.map(p => `${p.x},${p.y}`));
  if (posSet.size !== placements.length) {
    return { valid: false, error: 'Doppelte Position.' };
  }

  // All in same row or column
  const sameRow = ys.every(y => y === ys[0]);
  const sameCol = xs.every(x => x === xs[0]);

  if (!sameRow && !sameCol) {
    return { valid: false, error: 'Steine müssen in einer Zeile oder Spalte liegen.' };
  }

  // Check continuity (no gaps)
  if (sameRow) {
    const y = ys[0];
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    for (let x = minX; x <= maxX; x++) {
      const placed = placements.some(p => p.x === x && p.y === y);
      const existing = board[y][x].tile !== null;
      if (!placed && !existing) {
        return { valid: false, error: 'Lücke in der Wortlinie.' };
      }
    }
  } else {
    const x = xs[0];
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    for (let y = minY; y <= maxY; y++) {
      const placed = placements.some(p => p.x === x && p.y === y);
      const existing = board[y][x].tile !== null;
      if (!placed && !existing) {
        return { valid: false, error: 'Lücke in der Wortlinie.' };
      }
    }
  }

  // First move must cover center
  if (isFirstMove) {
    const coversCenter = placements.some(p => p.x === CENTER.x && p.y === CENTER.y);
    if (!coversCenter) {
      return { valid: false, error: 'Der erste Zug muss das Mittelfeld (7,7) bedecken.' };
    }
    if (placements.length < 2) {
      return { valid: false, error: 'Der erste Zug muss mindestens 2 Buchstaben haben.' };
    }
  } else {
    // Must connect to existing tiles
    const connected = placements.some(p => hasAdjacentTile(board, p.x, p.y, placements));
    if (!connected) {
      return { valid: false, error: 'Wort muss an bestehende Steine angrenzen.' };
    }
  }

  return { valid: true };
}

function hasAdjacentTile(board: BoardCell[][], x: number, y: number, newPlacements: PlacementInput[]): boolean {
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) continue;
    if (board[ny][nx].tile !== null) return true;
    // Adjacent to another newly placed tile (for connectivity check vs. board)
  }
  return false;
}

export function getFormedWords(
  board: BoardCell[][],
  placements: (PlacementInput & { letter: string; value: number })[]
): string[] {
  const tempLetters: (string | null)[][] = Array.from({ length: BOARD_SIZE }, (_, r) =>
    Array.from({ length: BOARD_SIZE }, (_, c) => {
      const cell = board[r][c];
      if (!cell.tile) return null;
      return cell.tile.isBlank ? (cell.tile.blankLetter ?? '') : cell.tile.letter;
    })
  );

  for (const p of placements) {
    tempLetters[p.y][p.x] = p.blankLetter ?? p.letter;
  }

  const words: string[] = [];
  const seen = new Set<string>();

  const getWord = (r: number, c: number, dir: 'H' | 'V'): string | null => {
    // Find start
    let sr = r, sc = c;
    while (true) {
      const pr = dir === 'V' ? sr - 1 : sr;
      const pc = dir === 'H' ? sc - 1 : sc;
      if (pr < 0 || pc < 0 || tempLetters[pr][pc] === null) break;
      sr = pr; sc = pc;
    }

    let word = '';
    let cr = sr, cc = sc;
    while (cr < BOARD_SIZE && cc < BOARD_SIZE && tempLetters[cr][cc] !== null) {
      word += tempLetters[cr][cc];
      if (dir === 'H') cc++;
      else cr++;
    }

    if (word.length < 2) return null;
    const key = `${dir}-${sr}-${sc}`;
    if (seen.has(key)) return null;
    seen.add(key);

    // Only include if it contains a new placement
    const hasNew = placements.some(p => {
      if (dir === 'H') return p.y === sr && p.x >= sc && p.x < sc + word.length;
      return p.x === sc && p.y >= sr && p.y < sr + word.length;
    });
    if (!hasNew) return null;

    return word;
  };

  for (const p of placements) {
    const hw = getWord(p.y, p.x, 'H');
    if (hw) words.push(hw);
    const vw = getWord(p.y, p.x, 'V');
    if (vw) words.push(vw);
  }

  return words;
}
