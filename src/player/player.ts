import type {
  HostMessage, Tile, BoardCell, Player, TurnState, PlacementInput, QRPayload
} from '../shared/types';
import { WebRTCPlayer } from './webrtc-player';
import {
  renderRack, renderExchangeRack
} from './ui/rack';
import { renderActions, renderStatusBar } from './ui/actions';
import {
  renderPlayerPairingUI,
  startOfferScanner,
  displayAnswerQR
} from './ui/pairing';

interface PlayerClientState {
  playerId: string;
  gameId: string;
  playerIndex: number;
  rack: Tile[];
  board: BoardCell[][];
  players: Player[];
  scores: Record<string, number>;
  bagCount: number;
  currentTurn: TurnState | null;
  phase: 'lobby' | 'playing' | 'ended';
}

export class PlayerClient {
  private webrtc: WebRTCPlayer;
  private state: PlayerClientState;
  private selectedTileIds: Set<string> = new Set();
  private pendingPlacements: PlacementInput[] = [];
  private isExchangeMode = false;
  private appContainer: HTMLElement;
  private savedPlayerId: string | null = null;
  private savedPlayerName: string | null = null;

  constructor(appContainer: HTMLElement) {
    this.appContainer = appContainer;
    this.webrtc = new WebRTCPlayer();
    this.state = {
      playerId: '',
      gameId: '',
      playerIndex: 0,
      rack: [],
      board: [],
      players: [],
      scores: {},
      bagCount: 0,
      currentTurn: null,
      phase: 'lobby',
    };

    this.savedPlayerId = localStorage.getItem('cw_playerId');
    this.savedPlayerName = localStorage.getItem('cw_playerName');

    this.webrtc.onMessage = (msg) => this.handleHostMessage(msg);
    this.webrtc.onStateChange = (s) => {
      if (s === 'disconnected') this.showDisconnected();
    };
  }

  showJoinScreen(): void {
    this.appContainer.innerHTML = `
      <div class="screen join-screen">
        <h1>Kreuzwortspiel</h1>
        <div class="name-input-group">
          <label for="player-name">Dein Name:</label>
          <input type="text" id="player-name" class="name-input" placeholder="Name eingeben" 
            value="${escapeHtml(this.savedPlayerName ?? '')}" maxlength="20" />
        </div>
        <button class="btn btn-primary" id="btn-join">📷 Spiel beitreten</button>
      </div>
    `;

    document.getElementById('btn-join')?.addEventListener('click', () => {
      const nameInput = document.getElementById('player-name') as HTMLInputElement;
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      this.savedPlayerName = name;
      localStorage.setItem('cw_playerName', name);
      this.showPairingScreen();
    });
  }

  private showPairingScreen(): void {
    renderPlayerPairingUI(this.appContainer, 'scan-offer');

    // Start the QR scanner after DOM is rendered
    setTimeout(() => {
      const scannerDiv = document.getElementById('offer-scanner-container');
      if (!scannerDiv) return;
      startOfferScanner('offer-scanner-container', (payload) => {
        this.onOfferScanned(payload);
      }).catch(err => {
        scannerDiv.innerHTML = `<p class="error">Kamera nicht verfügbar: ${(err as Error).message}</p>`;
      });
    }, 100);
  }

  private async onOfferScanned(offerPayload: QRPayload): Promise<void> {
    renderPlayerPairingUI(this.appContainer, 'show-answer');

    let answerPayload: QRPayload;
    try {
      answerPayload = await this.webrtc.connectFromOffer(offerPayload);
    } catch (err) {
      this.appContainer.innerHTML = `<p class="error">Verbindungsfehler: ${(err as Error).message}</p>`;
      return;
    }

    const qrContainer = document.getElementById('answer-qr-container');
    if (qrContainer) {
      await displayAnswerQR(qrContainer, answerPayload);
    }

    // Send join message once connected
    this.webrtc.onStateChange = (state) => {
      if (state === 'connected') {
        if (this.savedPlayerId) {
          this.webrtc.send({
            type: 'player:rejoin',
            playerId: this.savedPlayerId,
            playerName: this.savedPlayerName ?? 'Spieler',
          });
        } else {
          this.webrtc.send({
            type: 'player:join',
            playerName: this.savedPlayerName ?? 'Spieler',
          });
        }
        renderPlayerPairingUI(this.appContainer, 'connected');
      } else if (state === 'disconnected') {
        this.showDisconnected();
      }
    };
  }

  private handleHostMessage(msg: HostMessage): void {
    switch (msg.type) {
      case 'player:welcome':
        this.state.playerId = msg.playerId;
        this.state.gameId = msg.gameId;
        this.state.playerIndex = msg.playerIndex;
        localStorage.setItem('cw_playerId', msg.playerId);
        localStorage.setItem('cw_gameId', msg.gameId);
        break;

      case 'state:snapshot':
        this.state.board = msg.board;
        this.state.players = msg.players;
        this.state.scores = msg.scores;
        this.state.bagCount = msg.bagCount;
        this.state.currentTurn = msg.currentTurn;
        this.state.rack = msg.rack;
        this.state.phase = 'playing';
        this.renderGameScreen();
        break;

      case 'move:committed':
        this.pendingPlacements = [];
        this.selectedTileIds.clear();
        break;

      case 'turn:changed':
        if (this.state.currentTurn) {
          this.state.currentTurn.currentPlayerId = msg.currentPlayerId;
          this.state.currentTurn.roundNumber = msg.roundNumber;
        }
        this.renderGameScreen();
        break;

      case 'game:ended':
        this.state.phase = 'ended';
        this.state.scores = msg.finalScores;
        this.renderEndScreen(msg.winner);
        break;

      case 'error':
        this.showError(msg.message);
        break;

      default:
        break;
    }
  }

  private renderGameScreen(): void {
    const isMyTurn = this.state.currentTurn?.currentPlayerId === this.state.playerId;

    this.appContainer.innerHTML = `
      <div class="player-game-screen">
        <div id="status-bar-container"></div>
        <div id="rack-container"></div>
        <div id="actions-container"></div>
        <div id="message-area" class="message-area"></div>
      </div>
    `;

    const statusContainer = document.getElementById('status-bar-container')!;
    const rackContainer = document.getElementById('rack-container')!;
    const actionsContainer = document.getElementById('actions-container')!;

    renderStatusBar(
      statusContainer,
      this.state.players,
      this.state.scores,
      this.state.currentTurn?.currentPlayerId ?? '',
      this.state.bagCount,
      this.state.playerId
    );

    if (this.isExchangeMode) {
      renderExchangeRack(rackContainer, this.state.rack, this.selectedTileIds, (tile) => {
        if (this.selectedTileIds.has(tile.id)) this.selectedTileIds.delete(tile.id);
        else this.selectedTileIds.add(tile.id);
        this.renderGameScreen();
      });
    } else {
      renderRack(rackContainer, this.state.rack, this.selectedTileIds, (tile) => {
        if (!isMyTurn) return;
        if (this.selectedTileIds.has(tile.id)) this.selectedTileIds.delete(tile.id);
        else this.selectedTileIds.add(tile.id);
        this.renderGameScreen();
      });
    }

    renderActions(actionsContainer, isMyTurn, this.isExchangeMode, {
      onCommit: () => {
        if (this.pendingPlacements.length === 0) {
          this.showError('Keine Steine gelegt.');
          return;
        }
        this.webrtc.send({ type: 'move:commit' });
      },
      onUnplace: () => {
        const ids = Array.from(this.selectedTileIds);
        if (ids.length === 0) {
          // Unplace all
          const allIds = this.pendingPlacements.map(p => p.tileId);
          this.webrtc.send({ type: 'move:unplace', tileIds: allIds });
          this.pendingPlacements = [];
        } else {
          this.webrtc.send({ type: 'move:unplace', tileIds: ids });
          this.pendingPlacements = this.pendingPlacements.filter(p => !ids.includes(p.tileId));
        }
        this.selectedTileIds.clear();
        this.renderGameScreen();
      },
      onExchange: () => {
        this.isExchangeMode = true;
        this.selectedTileIds.clear();
        this.renderGameScreen();
      },
      onPass: () => {
        this.webrtc.send({ type: 'turn:pass' });
      },
      onConfirmExchange: () => {
        const ids = Array.from(this.selectedTileIds);
        if (ids.length === 0) {
          this.showError('Keine Steine ausgewählt.');
          return;
        }
        this.webrtc.send({ type: 'turn:exchange', tileIds: ids });
        this.isExchangeMode = false;
        this.selectedTileIds.clear();
      },
      onCancelExchange: () => {
        this.isExchangeMode = false;
        this.selectedTileIds.clear();
        this.renderGameScreen();
      },
    });
  }

  private renderEndScreen(winnerId: string): void {
    const sorted = [...this.state.players].sort(
      (a, b) => (this.state.scores[b.id] ?? 0) - (this.state.scores[a.id] ?? 0)
    );
    const winnerName = this.state.players.find(p => p.id === winnerId)?.name ?? 'Unbekannt';

    this.appContainer.innerHTML = `
      <div class="screen end-screen">
        <h1>🏆 Spielende!</h1>
        <p>Gewinner: <strong>${escapeHtml(winnerName)}</strong></p>
        <table class="score-table">
          <thead><tr><th>Spieler</th><th>Punkte</th></tr></thead>
          <tbody>
            ${sorted.map(p => `
              <tr class="${p.id === this.state.playerId ? 'me' : ''}">
                <td>${escapeHtml(p.name)}</td>
                <td>${this.state.scores[p.id] ?? 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <button class="btn btn-primary" onclick="location.reload()">Neues Spiel</button>
      </div>
    `;
  }

  private showDisconnected(): void {
    const area = document.getElementById('message-area');
    if (area) {
      area.innerHTML = '<div class="error-banner">⚠️ Verbindung unterbrochen. Bitte neu verbinden.</div>';
    } else {
      this.appContainer.innerHTML += '<div class="error-banner">⚠️ Verbindung unterbrochen.</div>';
    }
  }

  private showError(msg: string): void {
    const area = document.getElementById('message-area');
    if (area) {
      area.innerHTML = `<div class="error-toast">${escapeHtml(msg)}</div>`;
      setTimeout(() => { area.innerHTML = ''; }, 3000);
    }
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
