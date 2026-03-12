export interface ActionCallbacks {
  onCommit: () => void;
  onUnplace: () => void;
  onExchange: () => void;
  onPass: () => void;
  onConfirmExchange: () => void;
  onCancelExchange: () => void;
}

export function renderActions(
  container: HTMLElement,
  isMyTurn: boolean,
  isExchangeMode: boolean,
  callbacks: ActionCallbacks
): void {
  container.innerHTML = '';
  container.className = 'actions-container';

  if (!isMyTurn) {
    container.innerHTML = '<p class="waiting-turn">Warte auf deinen Zug…</p>';
    return;
  }

  if (isExchangeMode) {
    const btnConfirm = createButton('✅ Tauschen bestätigen', 'btn btn-confirm', callbacks.onConfirmExchange);
    const btnCancel = createButton('❌ Abbrechen', 'btn btn-cancel', callbacks.onCancelExchange);
    container.appendChild(btnConfirm);
    container.appendChild(btnCancel);
    return;
  }

  const btnCommit = createButton('✅ Bestätigen', 'btn btn-commit', callbacks.onCommit);
  const btnUnplace = createButton('↩ Zurücknehmen', 'btn btn-unplace', callbacks.onUnplace);
  const btnExchange = createButton('🔄 Tauschen', 'btn btn-exchange', callbacks.onExchange);
  const btnPass = createButton('⏭ Passen', 'btn btn-pass', callbacks.onPass);

  container.appendChild(btnCommit);
  container.appendChild(btnUnplace);
  container.appendChild(btnExchange);
  container.appendChild(btnPass);
}

function createButton(text: string, className: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = className;
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

export function renderStatusBar(
  container: HTMLElement,
  players: { id: string; name: string; score: number }[],
  scores: Record<string, number>,
  currentPlayerId: string,
  bagCount: number,
  myPlayerId: string
): void {
  container.innerHTML = `
    <div class="status-bar">
      <span class="bag-mini">🎒 ${bagCount}</span>
      ${players.map(p => `
        <span class="player-mini ${p.id === currentPlayerId ? 'current' : ''} ${p.id === myPlayerId ? 'me' : ''}">
          ${p.id === myPlayerId ? '(Ich) ' : ''}${escapeHtml(p.name)}: ${scores[p.id] ?? 0}
        </span>
      `).join(' | ')}
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
