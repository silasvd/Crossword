import { openDB, type IDBPDatabase } from 'idb';
import type { GameState } from '../shared/types';

const DB_NAME = 'kreuzwortspiel';
const DB_VERSION = 1;
const STORE = 'games';

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'gameId' });
      }
    },
  });
}

export async function saveGame(state: GameState): Promise<void> {
  const db = await getDB();
  await db.put(STORE, { ...state, updatedAt: Date.now() });
}

export async function loadGame(gameId: string): Promise<GameState | null> {
  const db = await getDB();
  const result = await db.get(STORE, gameId);
  return result ?? null;
}

export async function loadLatestGame(): Promise<GameState | null> {
  const db = await getDB();
  const all = await db.getAll(STORE);
  if (all.length === 0) return null;
  all.sort((a, b) => b.updatedAt - a.updatedAt);
  return all[0] as GameState;
}

export async function deleteGame(gameId: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, gameId);
}

export async function hasSavedGame(): Promise<boolean> {
  const db = await getDB();
  const count = await db.count(STORE);
  return count > 0;
}
