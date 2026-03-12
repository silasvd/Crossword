import type { Player } from '../../shared/types';

export function renderScoreboard(container: HTMLElement, players: Player[], scores: Record<string, number>, currentPlayerId: string, bagCount: number): void {
  container.innerHTML = `
    <div class="scoreboard">
      <h3>Punkte</h3>
      <div class="bag-count">🎒 Beutel: <strong>${bagCount}</strong></div>
      <table class="score-table">
        <tbody>
          ${players.map(p => `
            <tr class="player-row ${p.id === currentPlayerId ? 'current-player' : ''}">
              <td class="player-name">
                ${p.id === currentPlayerId ? '▶ ' : ''}${escapeHtml(p.name)}
                ${p.connected ? '' : ' <span class="offline-badge">⊗</span>'}
              </td>
              <td class="player-score">${scores[p.id] ?? 0}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function renderEndScoreboard(container: HTMLElement, players: Player[], finalScores: Record<string, number>, winnerId: string): void {
  const sorted = [...players].sort((a, b) => (finalScores[b.id] ?? 0) - (finalScores[a.id] ?? 0));
  container.innerHTML = `
    <div class="scoreboard end-scoreboard">
      <h2>Spielende!</h2>
      <table class="score-table">
        <thead><tr><th>Spieler</th><th>Punkte</th></tr></thead>
        <tbody>
          ${sorted.map((p, i) => `
            <tr class="${p.id === winnerId ? 'winner-row' : ''}">
              <td>${i === 0 ? '🏆 ' : ''}${escapeHtml(p.name)}</td>
              <td>${finalScores[p.id] ?? 0}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
