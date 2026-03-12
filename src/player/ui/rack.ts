import type { Tile } from '../../shared/types';

export function renderRack(
  container: HTMLElement,
  rack: Tile[],
  selectedIds: Set<string>,
  onTileClick: (tile: Tile) => void
): void {
  container.innerHTML = '';
  container.className = 'rack-container';

  if (rack.length === 0) {
    container.innerHTML = '<div class="rack-empty">Kein Rack verfügbar</div>';
    return;
  }

  for (const tile of rack) {
    const div = document.createElement('div');
    div.className = 'rack-tile';
    if (selectedIds.has(tile.id)) div.classList.add('selected');
    if (tile.isBlank) div.classList.add('blank-tile');

    const letter = tile.isBlank ? (tile.blankLetter ?? '') : tile.letter;
    div.innerHTML = `
      <span class="tile-letter">${letter}</span>
      <span class="tile-value">${tile.value}</span>
    `;

    div.addEventListener('click', () => onTileClick(tile));
    container.appendChild(div);
  }
}

export function renderExchangeRack(
  container: HTMLElement,
  rack: Tile[],
  selectedIds: Set<string>,
  onTileClick: (tile: Tile) => void
): void {
  container.innerHTML = '';
  container.className = 'rack-container exchange-mode';

  const label = document.createElement('p');
  label.className = 'exchange-label';
  label.textContent = 'Wähle Steine zum Tauschen:';
  container.appendChild(label);

  for (const tile of rack) {
    const div = document.createElement('div');
    div.className = 'rack-tile';
    if (selectedIds.has(tile.id)) div.classList.add('selected-exchange');
    if (tile.isBlank) div.classList.add('blank-tile');

    const letter = tile.isBlank ? (tile.blankLetter ?? '') : tile.letter;
    div.innerHTML = `
      <span class="tile-letter">${letter}</span>
      <span class="tile-value">${tile.value}</span>
    `;

    div.addEventListener('click', () => onTileClick(tile));
    container.appendChild(div);
  }
}
