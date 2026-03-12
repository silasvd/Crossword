import type { BoardCell, PlacementInput, Tile, WordResult } from './types';
import { BOARD_SIZE, BINGO_BONUS, RACK_SIZE } from './constants';

interface TempCell {
  tile: Tile;
  isNew: boolean;
}

export function calculateScore(
  board: BoardCell[][],
  placements: (PlacementInput & { letter: string; value: number })[],
  isFirstMove: boolean
): { words: WordResult[]; total: number } {
  const tempBoard: (TempCell | null)[][] = Array.from({ length: BOARD_SIZE }, (_, r) =>
    Array.from({ length: BOARD_SIZE }, (_, c) => {
      const cell = board[r][c];
      if (cell.tile) return { tile: cell.tile, isNew: false };
      return null;
    })
  );

  for (const p of placements) {
    const letter = p.blankLetter ?? p.letter;
    tempBoard[p.y][p.x] = {
      tile: {
        id: p.tileId,
        letter: p.letter,
        value: p.value,
        isBlank: p.letter === '',
        blankLetter: p.blankLetter,
      },
      isNew: true,
    };
  }

  const words: WordResult[] = [];
  const scored = new Set<string>();

  const getWordAt = (startR: number, startC: number, dir: 'H' | 'V'): WordResult | null => {
    const key = `${dir}-${startR}-${startC}`;
    if (scored.has(key)) return null;

    const tiles: { tile: Tile; x: number; y: number; isNew: boolean }[] = [];
    let r = startR;
    let c = startC;

    while (r < BOARD_SIZE && c < BOARD_SIZE && tempBoard[r][c] !== null) {
      const cell = tempBoard[r][c]!;
      tiles.push({ tile: cell.tile, x: c, y: r, isNew: cell.isNew });
      if (dir === 'H') c++;
      else r++;
    }

    if (tiles.length < 2) return null;
    if (!tiles.some(t => t.isNew)) return null;

    scored.add(key);

    let wordScore = 0;
    let wordMultiplier = 1;
    const wordLetters: string[] = [];

    for (const t of tiles) {
      const cell = board[t.y][t.x];
      const letter = t.tile.isBlank ? (t.tile.blankLetter ?? '') : t.tile.letter;
      wordLetters.push(letter);
      let tileValue = t.tile.value;

      if (t.isNew && !cell.bonusUsed) {
        const bonus = cell.bonus;
        if (bonus === 'DL') tileValue *= 2;
        else if (bonus === 'TL') tileValue *= 3;
        else if (bonus === 'DW') wordMultiplier *= 2;
        else if (bonus === 'TW') wordMultiplier *= 3;
      }
      wordScore += tileValue;
    }

    return {
      word: wordLetters.join(''),
      score: wordScore * wordMultiplier,
      tiles,
    };
  };

  // Find start of word
  const findStart = (r: number, c: number, dir: 'H' | 'V'): [number, number] => {
    while (true) {
      const pr = dir === 'V' ? r - 1 : r;
      const pc = dir === 'H' ? c - 1 : c;
      if (pr < 0 || pc < 0 || tempBoard[pr][pc] === null) break;
      r = pr;
      c = pc;
    }
    return [r, c];
  };

  for (const p of placements) {
    // Check horizontal word
    const [hr, hc] = findStart(p.y, p.x, 'H');
    const hw = getWordAt(hr, hc, 'H');
    if (hw) words.push(hw);

    // Check vertical word
    const [vr, vc] = findStart(p.y, p.x, 'V');
    const vw = getWordAt(vr, vc, 'V');
    if (vw) words.push(vw);
  }

  let total = words.reduce((sum, w) => sum + w.score, 0);
  if (placements.length === RACK_SIZE) total += BINGO_BONUS;

  return { words, total };
}

export function calculateEndScores(
  scores: Record<string, number>,
  players: { id: string; rack: Tile[] }[]
): Record<string, number> {
  const result = { ...scores };
  let emptyRackPlayerId: string | null = null;
  let totalRemaining = 0;

  for (const p of players) {
    const remaining = p.rack.reduce((sum, t) => sum + t.value, 0);
    if (remaining === 0) {
      emptyRackPlayerId = p.id;
    } else {
      result[p.id] = (result[p.id] ?? 0) - remaining;
      totalRemaining += remaining;
    }
  }

  if (emptyRackPlayerId !== null) {
    result[emptyRackPlayerId] = (result[emptyRackPlayerId] ?? 0) + totalRemaining;
  }

  return result;
}
