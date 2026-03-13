import type {
  GameState, BoardCell, Tile, Player, PlacementInput, PlacedTile,
  MsgStateSnapshot, ClientMessage, TurnState
} from '../shared/types';
import { BOARD_SIZE, RACK_SIZE, CENTER, createBag, shuffleArray, generateId, getBonusAt } from '../shared/constants';
import { validatePlacements, getFormedWords } from '../shared/validation';
import { calculateScore, calculateEndScores } from '../shared/scoring';
import { saveGame, loadLatestGame } from './persistence';
import { WebRTCHost, type ConnectionState } from './webrtc-host';

export class HostEngine {
  state!: GameState;
  webrtc!: WebRTCHost;
  private onStateChange: (() => void) | null = null;
  private extraConnectionObserver: ((peerId: string, state: ConnectionState) => void) | null = null;

  constructor(onStateChange: () => void) {
    this.onStateChange = onStateChange;
  }

  setConnectionObserver(observer: (peerId: string, state: ConnectionState) => void): void {
    this.extraConnectionObserver = observer;
  }

  createNewGame(): void {
    const gameId = generateId(6);
    const bag = shuffleArray(createBag());
    const board: BoardCell[][] = Array.from({ length: BOARD_SIZE }, (_, r) =>
      Array.from({ length: BOARD_SIZE }, (_, c) => ({
        tile: null,
        bonus: getBonusAt(r, c),
        bonusUsed: false,
      }))
    );

    this.state = {
      gameId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      board,
      bag,
      players: [],
      scores: {},
      turn: { currentPlayerId: '', roundNumber: 1, consecutivePasses: 0 },
      moveHistory: [],
      settings: { dictionaryEnabled: false, language: 'de' },
      phase: 'lobby',
    };

    this.webrtc = new WebRTCHost(
      gameId,
      (peerId, msg) => this.handleClientMessage(peerId, msg),
      (peerId, state) => this.handleConnectionChange(peerId, state)
    );
  }

  async resumeGame(): Promise<boolean> {
    const saved = await loadLatestGame();
    if (!saved) return false;

    this.state = saved;

    this.webrtc = new WebRTCHost(
      saved.gameId,
      (peerId, msg) => this.handleClientMessage(peerId, msg),
      (peerId, state) => this.handleConnectionChange(peerId, state)
    );

    // Mark all players as disconnected
    for (const p of this.state.players) {
      p.connected = false;
    }

    return true;
  }

  addPlayer(name: string): Player {
    const id = generateId(8);
    const rack = this.drawTiles(RACK_SIZE);
    const player: Player = {
      id,
      name,
      score: 0,
      rack,
      connected: true,
      index: this.state.players.length,
    };
    this.state.players.push(player);
    this.state.scores[id] = 0;
    return player;
  }

  startGame(): void {
    if (this.state.players.length < 1) return;
    this.state.phase = 'playing';
    this.state.turn.currentPlayerId = this.state.players[0].id;
    this.state.turn.roundNumber = 1;
    this.state.turn.consecutivePasses = 0;
    this.persistState();
    this.broadcastState();
  }

  private handleClientMessage(peerId: string, msg: ClientMessage): void {
    switch (msg.type) {
      case 'player:join':
        this.handlePlayerJoin(peerId, msg.playerName);
        break;
      case 'player:rejoin':
        this.handlePlayerRejoin(peerId, msg.playerId, msg.playerName);
        break;
      case 'move:place':
        this.handleMovePlace(peerId, msg.placements);
        break;
      case 'move:unplace':
        this.handleMoveUnplace(peerId, msg.tileIds);
        break;
      case 'move:commit':
        this.handleMoveCommit(peerId);
        break;
      case 'turn:exchange':
        this.handleExchange(peerId, msg.tileIds);
        break;
      case 'turn:pass':
        this.handlePass(peerId);
        break;
      case 'rack:reorder':
        this.handleRackReorder(peerId, msg.tileOrder);
        break;
      default:
        break;
    }
  }

  private handleConnectionChange(peerId: string, state: ConnectionState): void {
    const player = this.state.players.find(p => p.id === peerId);
    if (player) {
      player.connected = state === 'connected';
    }
    this.extraConnectionObserver?.(peerId, state);
    this.onStateChange?.();
  }

  private handlePlayerJoin(peerId: string, playerName: string): void {
    if (this.state.phase === 'ended') return;

    const existing = this.state.players.find(p => p.id === peerId);
    if (existing) {
      existing.connected = true;
      this.sendSnapshot(peerId, existing);
      return;
    }

    const player = this.addPlayer(playerName);
    // Override the auto-generated id with peerId for WebRTC alignment
    const oldId = player.id;
    player.id = peerId;
    this.state.scores[peerId] = 0;
    delete this.state.scores[oldId];

    this.webrtc.send(peerId, {
      type: 'player:welcome',
      playerId: peerId,
      gameId: this.state.gameId,
      playerIndex: player.index,
    });

    this.sendSnapshot(peerId, player);
    this.onStateChange?.();
  }

  private handlePlayerRejoin(peerId: string, playerId: string, _playerName: string): void {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player) {
      this.webrtc.send(peerId, { type: 'error', code: 'NOT_FOUND', message: 'Spieler nicht gefunden.' });
      return;
    }

    player.connected = true;

    this.webrtc.send(peerId, {
      type: 'player:welcome',
      playerId: player.id,
      gameId: this.state.gameId,
      playerIndex: player.index,
    });

    this.sendSnapshot(peerId, player);
    this.onStateChange?.();
  }

  private pendingPlacements: Map<string, PlacementInput[]> = new Map();

  private handleMovePlace(peerId: string, placements: PlacementInput[]): void {
    if (!this.isCurrentPlayer(peerId)) return;
    this.pendingPlacements.set(peerId, placements);
    // Broadcast preview to all
    this.webrtc.broadcast({ type: 'move:preview', playerId: peerId, placements });
    this.onStateChange?.();
  }

  private handleMoveUnplace(peerId: string, tileIds: string[]): void {
    if (!this.isCurrentPlayer(peerId)) return;
    const current = this.pendingPlacements.get(peerId) ?? [];
    const updated = current.filter(p => !tileIds.includes(p.tileId));
    this.pendingPlacements.set(peerId, updated);
    this.webrtc.broadcast({ type: 'move:preview', playerId: peerId, placements: updated });
    this.onStateChange?.();
  }

  private handleMoveCommit(peerId: string): void {
    if (!this.isCurrentPlayer(peerId)) return;

    const player = this.getPlayer(peerId);
    if (!player) return;

    const pending = this.pendingPlacements.get(peerId) ?? [];
    if (pending.length === 0) return;

    // Build full placements with letter/value
    const fullPlacements: (PlacementInput & { letter: string; value: number })[] = pending.map(p => {
      const tile = player.rack.find(t => t.id === p.tileId);
      if (!tile) throw new Error(`Tile ${p.tileId} not in rack`);
      return {
        ...p,
        letter: tile.letter,
        value: tile.value,
      };
    });

    const isFirst = this.state.moveHistory.filter(m => m.type === 'place').length === 0;
    const validation = validatePlacements(this.state.board, pending, isFirst);
    if (!validation.valid) {
      this.webrtc.send(peerId, { type: 'error', code: 'INVALID_MOVE', message: validation.error ?? 'Ungültiger Zug.' });
      return;
    }

    const { words, total } = calculateScore(this.state.board, fullPlacements, isFirst);
    const wordsFormed = getFormedWords(this.state.board, fullPlacements);

    // Place tiles on board
    const placedTiles: PlacedTile[] = [];
    for (const p of fullPlacements) {
      const tile = player.rack.find(t => t.id === p.tileId)!;
      if (p.blankLetter) tile.blankLetter = p.blankLetter;
      this.state.board[p.y][p.x].tile = { ...tile };
      if (this.state.board[p.y][p.x].bonus) {
        this.state.board[p.y][p.x].bonusUsed = true;
      }
      placedTiles.push({ ...p, letter: tile.letter, value: tile.value });
    }

    // Remove placed tiles from rack
    const placedIds = pending.map(p => p.tileId);
    player.rack = player.rack.filter(t => !placedIds.includes(t.id));

    // Draw new tiles
    const drawn = this.drawTiles(RACK_SIZE - player.rack.length);
    player.rack.push(...drawn);

    // Update score
    this.state.scores[peerId] = (this.state.scores[peerId] ?? 0) + total;
    player.score = this.state.scores[peerId];

    // Record move
    this.state.moveHistory.push({
      playerId: peerId,
      type: 'place',
      placements: placedTiles,
      wordsFormed,
      points: total,
      timestamp: Date.now(),
    });

    this.pendingPlacements.delete(peerId);
    this.state.turn.consecutivePasses = 0;

    // Broadcast committed
    this.webrtc.broadcast({
      type: 'move:committed',
      playerId: peerId,
      placements: placedTiles,
      wordsFormed,
      points: total,
      newScores: { ...this.state.scores },
      tilesDrawn: drawn.length,
    });

    // Check end condition
    if (this.checkGameEnd()) return;

    this.advanceTurn();
    this.persistState();
    this.onStateChange?.();
  }

  private handleExchange(peerId: string, tileIds: string[]): void {
    if (!this.isCurrentPlayer(peerId)) return;

    const player = this.getPlayer(peerId);
    if (!player) return;

    if (this.state.bag.length < RACK_SIZE) {
      this.webrtc.send(peerId, { type: 'error', code: 'BAG_TOO_SMALL', message: 'Nicht genug Steine im Beutel.' });
      return;
    }

    const toReturn = player.rack.filter(t => tileIds.includes(t.id));
    player.rack = player.rack.filter(t => !tileIds.includes(t.id));

    const drawn = this.drawTiles(toReturn.length);
    this.state.bag.push(...shuffleArray(toReturn));
    player.rack.push(...drawn);

    this.state.moveHistory.push({
      playerId: peerId,
      type: 'exchange',
      points: 0,
      timestamp: Date.now(),
    });

    this.state.turn.consecutivePasses++;
    this.advanceTurn();
    this.persistState();
    this.broadcastState();
    this.onStateChange?.();
  }

  private handlePass(peerId: string): void {
    if (!this.isCurrentPlayer(peerId)) return;

    this.state.moveHistory.push({
      playerId: peerId,
      type: 'pass',
      points: 0,
      timestamp: Date.now(),
    });

    this.state.turn.consecutivePasses++;

    if (this.checkGameEnd()) return;

    this.advanceTurn();
    this.persistState();
    this.broadcastState();
    this.onStateChange?.();
  }

  private handleRackReorder(peerId: string, tileOrder: string[]): void {
    const player = this.getPlayer(peerId);
    if (!player) return;
    const reordered: Tile[] = [];
    for (const id of tileOrder) {
      const tile = player.rack.find(t => t.id === id);
      if (tile) reordered.push(tile);
    }
    // Add any tiles not in the order list at the end
    for (const t of player.rack) {
      if (!tileOrder.includes(t.id)) reordered.push(t);
    }
    player.rack = reordered;
  }

  private checkGameEnd(): boolean {
    const player = this.getPlayer(this.state.turn.currentPlayerId);
    if (player && player.rack.length === 0 && this.state.bag.length === 0) {
      this.endGame();
      return true;
    }

    if (this.state.turn.consecutivePasses >= this.state.players.length * 2) {
      this.endGame();
      return true;
    }

    return false;
  }

  private endGame(): void {
    this.state.phase = 'ended';
    const finalScores = calculateEndScores(
      this.state.scores,
      this.state.players.map(p => ({ id: p.id, rack: p.rack }))
    );
    this.state.scores = finalScores;

    let winnerId = '';
    let maxScore = -Infinity;
    for (const [id, score] of Object.entries(finalScores)) {
      if (score > maxScore) {
        maxScore = score;
        winnerId = id;
      }
    }

    this.webrtc.broadcast({
      type: 'game:ended',
      finalScores,
      winner: winnerId,
    });

    this.persistState();
    this.onStateChange?.();
  }

  private advanceTurn(): void {
    const players = this.state.players;
    const idx = players.findIndex(p => p.id === this.state.turn.currentPlayerId);
    const nextIdx = (idx + 1) % players.length;
    if (nextIdx === 0) this.state.turn.roundNumber++;
    this.state.turn.currentPlayerId = players[nextIdx].id;

    this.webrtc.broadcast({
      type: 'turn:changed',
      currentPlayerId: this.state.turn.currentPlayerId,
      roundNumber: this.state.turn.roundNumber,
    });

    // Send updated rack to new current player
    const nextPlayer = players[nextIdx];
    if (nextPlayer.connected) {
      this.sendSnapshot(nextPlayer.id, nextPlayer);
    }
  }

  private drawTiles(count: number): Tile[] {
    const drawn: Tile[] = [];
    for (let i = 0; i < count && this.state.bag.length > 0; i++) {
      drawn.push(this.state.bag.pop()!);
    }
    return drawn;
  }

  private sendSnapshot(peerId: string, player: Player): void {
    const msg: MsgStateSnapshot = {
      type: 'state:snapshot',
      board: this.state.board,
      players: this.state.players.map(p => ({ ...p, rack: [] })),
      scores: this.state.scores,
      bagCount: this.state.bag.length,
      currentTurn: this.state.turn,
      rack: player.rack,
    };
    this.webrtc.send(peerId, msg);
  }

  broadcastState(): void {
    for (const player of this.state.players) {
      if (player.connected) {
        this.sendSnapshot(player.id, player);
      }
    }
  }

  getPendingPlacements(peerId: string): PlacementInput[] {
    return this.pendingPlacements.get(peerId) ?? [];
  }

  private isCurrentPlayer(peerId: string): boolean {
    return this.state.phase === 'playing' && this.state.turn.currentPlayerId === peerId;
  }

  private getPlayer(id: string): Player | undefined {
    return this.state.players.find(p => p.id === id);
  }

  private async persistState(): Promise<void> {
    await saveGame(this.state);
  }
}
