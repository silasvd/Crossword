import { PlayerClient } from './player/player';

export function initPlayer(app: HTMLElement): void {
  const client = new PlayerClient(app);
  client.showJoinScreen();
}
