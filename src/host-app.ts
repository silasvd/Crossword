import type { QRPayload, PlacementInput } from './shared/types';
import { HostEngine } from './host/host';
import { hasSavedGame } from './host/persistence';
import { renderBoard } from './host/ui/board';
import { renderScoreboard, renderEndScoreboard } from './host/ui/scoreboard';
import type { ConnectionState } from './host/webrtc-host';
import {
  displayOfferQR,
  startAnswerScanner,
  stopScanner,
  renderPairingUI,
  type PairingSlot
} from './host/ui/pairing';

export async function initHost(app: HTMLElement): Promise<void> {
  const saved = await hasSavedGame();
  showHostStartScreen(app, saved);
}

function showHostStartScreen(app: HTMLElement, hasSaved: boolean): void {
  app.innerHTML = `
    <div class="screen host-start">
      <h1>🔤 Kreuzwortspiel</h1>
      <p class="subtitle">Host-Gerät</p>
      <div class="start-buttons">
        <button class="btn btn-primary" id="btn-new-game">🆕 Neues Spiel</button>
        ${hasSaved ? '<button class="btn btn-secondary" id="btn-resume">▶️ Spiel fortsetzen</button>' : ''}
        <button class="btn btn-back" id="btn-back">← Zurück</button>
      </div>
    </div>
  `;

  document.getElementById('btn-new-game')?.addEventListener('click', () => {
    startNewGame(app);
  });

  document.getElementById('btn-resume')?.addEventListener('click', () => {
    resumeGame(app);
  });

  document.getElementById('btn-back')?.addEventListener('click', () => {
    localStorage.removeItem('cwMode');
    location.reload();
  });
}

async function resumeGame(app: HTMLElement): Promise<void> {
  const engine = new HostEngine(() => refreshHostUI(app, engine));
  const resumed = await engine.resumeGame();
  if (!resumed) {
    alert('Kein gespeichertes Spiel gefunden.');
    return;
  }

  // Go straight to pairing to reconnect players
  showPairingScreen(app, engine);
}

function startNewGame(app: HTMLElement): void {
  app.innerHTML = `
    <div class="screen host-setup">
      <h2>Neues Spiel einrichten</h2>
      <div class="player-count-select">
        <label>Anzahl Spieler:</label>
        <div class="count-buttons">
          ${[2, 3, 4].map(n => `<button class="btn btn-count" data-count="${n}">${n}</button>`).join('')}
        </div>
      </div>
      <button class="btn btn-back" id="btn-back">← Zurück</button>
    </div>
  `;

  document.getElementById('btn-back')?.addEventListener('click', () => {
    showHostStartScreen(app, false);
  });

  document.querySelectorAll('.btn-count').forEach(btn => {
    btn.addEventListener('click', () => {
      const count = parseInt((btn as HTMLElement).dataset.count ?? '2', 10);
      setupGame(app, count);
    });
  });
}

function setupGame(app: HTMLElement, playerCount: number): void {
  const engine = new HostEngine(() => refreshHostUI(app, engine));
  engine.createNewGame();
  showPairingScreen(app, engine, playerCount);
}

async function showPairingScreen(app: HTMLElement, engine: HostEngine, expectedPlayers?: number): Promise<void> {
  const count = expectedPlayers ?? engine.state.players.length;
  const slots: PairingSlot[] = [];

  // Create WebRTC offers for each player slot
  for (let i = 0; i < count; i++) {
    const { peerId, payload } = await engine.webrtc.createPeerOffer(i);
    slots.push({
      index: i,
      peerId,
      offerPayload: payload,
      state: 'waiting-scan',
    });
  }

  renderPairingUI(app, slots, (slotIndex) => {
    startScanningAnswer(app, engine, slots, slotIndex);
  });

  // Render QR codes for each slot
  for (const slot of slots) {
    const container = document.getElementById(`qr-offer-${slot.index}`);
    if (container) {
      await displayOfferQR(container, slot.offerPayload);
    }
  }

  // Add "Start Game" button
  const pairingDiv = app.querySelector('.pairing-ui');
  if (pairingDiv) {
    const startBtn = document.createElement('button');
    startBtn.className = 'btn btn-primary start-game-btn';
    startBtn.textContent = '▶️ Spiel starten';
    startBtn.addEventListener('click', () => {
      engine.startGame();
      showGameScreen(app, engine);
    });
    pairingDiv.appendChild(startBtn);
  }

  // Listen for connection changes to update pairing UI
  engine.setConnectionObserver((peerId: string, state: ConnectionState) => {
    const slot = slots.find(s => s.peerId === peerId);
    if (slot && state === 'connected') {
      slot.state = 'connected';
      updateSlotUI(app, slot);
    }
  });
}

function updateSlotUI(app: HTMLElement, slot: PairingSlot): void {
  const slotEl = app.querySelector(`.pairing-slot[data-index="${slot.index}"]`);
  if (!slotEl) return;
  const statusEl = slotEl.querySelector('.slot-status');
  if (statusEl) {
    statusEl.innerHTML = '<p class="connected-badge">✅ Verbunden</p>';
  }
  slotEl.className = `pairing-slot connected`;
}

async function startScanningAnswer(
  app: HTMLElement,
  engine: HostEngine,
  slots: PairingSlot[],
  slotIndex: number
): Promise<void> {
  const slot = slots[slotIndex];
  slot.state = 'waiting-answer';

  const slotEl = app.querySelector(`.pairing-slot[data-index="${slotIndex}"]`);
  if (!slotEl) return;

  const statusEl = slotEl.querySelector('.slot-status');
  if (statusEl) {
    statusEl.innerHTML = `
      <p>Scanne Antwort-QR von Spieler ${slotIndex + 1}</p>
      <div id="host-scanner-${slotIndex}" class="scanner-container"></div>
      <button class="btn btn-cancel-scan" id="cancel-scan-${slotIndex}">Abbrechen</button>
    `;

    document.getElementById(`cancel-scan-${slotIndex}`)?.addEventListener('click', async () => {
      await stopScanner();
      slot.state = 'waiting-scan';
      renderPairingUI(app, slots, (idx) => startScanningAnswer(app, engine, slots, idx));
    });
  }

  await startAnswerScanner(`host-scanner-${slotIndex}`, async (payload: QRPayload) => {
    try {
      await engine.webrtc.acceptAnswer(payload);

      // Send join if engine has a player for this peer
      // The player will send join message themselves once DC opens
    } catch (err) {
      console.error('Failed to accept answer:', err);
    }
  });
}

function showGameScreen(app: HTMLElement, engine: HostEngine): void {
  app.innerHTML = `
    <div class="host-game-screen">
      <div class="game-header">
        <span class="game-id">Spiel: ${engine.state.gameId}</span>
        <span class="round-info" id="round-info">Runde ${engine.state.turn.roundNumber}</span>
      </div>
      <div class="game-main">
        <div id="board-container" class="board-wrapper"></div>
        <div class="game-sidebar">
          <div id="scoreboard-container"></div>
          <div id="move-log" class="move-log"></div>
        </div>
      </div>
    </div>
  `;

  refreshHostUI(app, engine);
}

function refreshHostUI(app: HTMLElement, engine: HostEngine): void {
  const boardContainer = document.getElementById('board-container');
  const scoreContainer = document.getElementById('scoreboard-container');
  const roundInfo = document.getElementById('round-info');

  if (!boardContainer || !scoreContainer) return;

  const state = engine.state;

  // Collect all pending placements for preview
  const allPending: PlacementInput[] = [];
  for (const player of state.players) {
    const pp = engine.getPendingPlacements(player.id);
    allPending.push(...pp);
  }

  if (state.phase === 'ended') {
    renderBoard(boardContainer, state.board, [], state.players);
    const winner = Object.entries(state.scores).reduce((a, b) => b[1] > a[1] ? b : a, ['', -Infinity])[0];
    renderEndScoreboard(scoreContainer, state.players, state.scores, winner);
  } else {
    renderBoard(boardContainer, state.board, allPending, state.players);
    renderScoreboard(
      scoreContainer,
      state.players,
      state.scores,
      state.turn.currentPlayerId,
      state.bag.length
    );
  }

  if (roundInfo) {
    roundInfo.textContent = `Runde ${state.turn.roundNumber}`;
  }
}
