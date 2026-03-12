export type BonusType = 'TW' | 'DW' | 'TL' | 'DL' | null;

export interface Tile {
  id: string;
  letter: string; // '' for blank
  value: number;
  isBlank: boolean;
  blankLetter?: string;
}

export interface BoardCell {
  tile: Tile | null;
  bonus: BonusType;
  bonusUsed: boolean;
}

export interface PlacementInput {
  tileId: string;
  x: number;
  y: number;
  blankLetter?: string;
}

export interface PlacedTile {
  tileId: string;
  x: number;
  y: number;
  blankLetter?: string;
  letter: string;
  value: number;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  rack: Tile[];
  connected: boolean;
  index: number;
}

export interface TurnState {
  currentPlayerId: string;
  roundNumber: number;
  consecutivePasses: number;
}

export interface GameSettings {
  dictionaryEnabled: boolean;
  language: string;
}

export interface MoveRecord {
  playerId: string;
  type: 'place' | 'exchange' | 'pass';
  placements?: PlacedTile[];
  wordsFormed?: string[];
  points: number;
  timestamp: number;
}

export interface WordResult {
  word: string;
  score: number;
  tiles: { tile: Tile; x: number; y: number; isNew: boolean }[];
}

export interface GameState {
  gameId: string;
  createdAt: number;
  updatedAt: number;
  board: BoardCell[][];
  bag: Tile[];
  players: Player[];
  scores: Record<string, number>;
  turn: TurnState;
  moveHistory: MoveRecord[];
  settings: GameSettings;
  phase: 'lobby' | 'playing' | 'ended';
}

// Client → Host messages
export interface MsgPlayerJoin { type: 'player:join'; playerName: string; }
export interface MsgPlayerRejoin { type: 'player:rejoin'; playerId: string; playerName: string; }
export interface MsgRackReorder { type: 'rack:reorder'; tileOrder: string[]; }
export interface MsgMovePlace { type: 'move:place'; placements: PlacementInput[]; }
export interface MsgMoveUnplace { type: 'move:unplace'; tileIds: string[]; }
export interface MsgMoveCommit { type: 'move:commit'; }
export interface MsgTurnExchange { type: 'turn:exchange'; tileIds: string[]; }
export interface MsgTurnPass { type: 'turn:pass'; }
export interface MsgChallengeVote { type: 'challenge:vote'; accept: boolean; }

export type ClientMessage =
  | MsgPlayerJoin | MsgPlayerRejoin | MsgRackReorder
  | MsgMovePlace | MsgMoveUnplace | MsgMoveCommit
  | MsgTurnExchange | MsgTurnPass | MsgChallengeVote;

// Host → Client messages
export interface MsgPlayerWelcome { type: 'player:welcome'; playerId: string; gameId: string; playerIndex: number; }
export interface MsgStateSnapshot {
  type: 'state:snapshot';
  board: BoardCell[][];
  players: Player[];
  scores: Record<string, number>;
  bagCount: number;
  currentTurn: TurnState;
  rack: Tile[];
}
export interface MsgStatePatch { type: 'state:patch'; changes: Partial<Omit<MsgStateSnapshot, 'type'>>; }
export interface MsgMovePreview { type: 'move:preview'; playerId: string; placements: PlacementInput[]; }
export interface MsgMoveCommitted {
  type: 'move:committed';
  playerId: string;
  placements: PlacedTile[];
  wordsFormed: string[];
  points: number;
  newScores: Record<string, number>;
  tilesDrawn: number;
}
export interface MsgTurnChanged { type: 'turn:changed'; currentPlayerId: string; roundNumber: number; }
export interface MsgChallengeStart { type: 'challenge:start'; challengedPlayerId: string; wordsInQuestion: string[]; }
export interface MsgChallengeResult { type: 'challenge:result'; accepted: boolean; votes: Record<string, boolean>; }
export interface MsgGameEnded { type: 'game:ended'; finalScores: Record<string, number>; winner: string; }
export interface MsgError { type: 'error'; code: string; message: string; }
export interface MsgPing { type: 'ping'; }
export interface MsgPong { type: 'pong'; }

export type HostMessage =
  | MsgPlayerWelcome | MsgStateSnapshot | MsgStatePatch
  | MsgMovePreview | MsgMoveCommitted | MsgTurnChanged
  | MsgChallengeStart | MsgChallengeResult | MsgGameEnded
  | MsgError | MsgPing | MsgPong;

export interface QRPayload {
  v: number;
  type: 'offer' | 'answer';
  gameId: string;
  peerId: string;
  sdp: string;
}
