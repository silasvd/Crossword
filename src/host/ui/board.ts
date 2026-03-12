import type { BoardCell, PlacementInput, Player } from '../../shared/types';
import { BOARD_SIZE } from '../../shared/constants';

export function renderBoard(
  container: HTMLElement,
  board: BoardCell[][],
  pendingPlacements: PlacementInput[],
  players: Player[],
  onCellClick?: (x: number, y: number) => void
): void {
  container.innerHTML = '';
  container.className = 'board-grid';

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cell = board[row][col];
      const div = document.createElement('div');
      div.className = 'board-cell';
      div.dataset.row = String(row);
      div.dataset.col = String(col);

      // Bonus class
      if (!cell.bonusUsed && !cell.tile) {
        if (cell.bonus) div.classList.add(`bonus-${cell.bonus.toLowerCase()}`);
      }

      // Center star
      if (row === 7 && col === 7 && !cell.tile) {
        div.classList.add('center-star');
      }

      if (cell.tile) {
        div.classList.add('has-tile');
        const tileLetter = cell.tile.isBlank ? (cell.tile.blankLetter ?? '') : cell.tile.letter;
        div.innerHTML = `<span class="tile-letter">${tileLetter}</span><span class="tile-value">${cell.tile.value}</span>`;

        // Find which player placed this (for coloring in multiplayer)
        // If it's in pending placements, mark as preview
        const isPending = pendingPlacements.some(p => p.x === col && p.y === row);
        if (isPending) div.classList.add('tile-preview');
      } else {
        // Check pending placements for preview
        const pending = pendingPlacements.find(p => p.x === col && p.y === row);
        if (pending) {
          div.classList.add('has-tile', 'tile-preview');
          div.innerHTML = `<span class="tile-letter">${pending.blankLetter ?? '?'}</span><span class="tile-value"></span>`;
        } else if (cell.bonus && !cell.bonusUsed) {
          div.textContent = cell.bonus;
        }
      }

      if (onCellClick) {
        div.addEventListener('click', () => onCellClick(col, row));
      }

      container.appendChild(div);
    }
  }
}

export function highlightCurrentPlayer(playerIndex: number): void {
  document.querySelectorAll('.player-slot').forEach((el, i) => {
    el.classList.toggle('active', i === playerIndex);
  });
}
