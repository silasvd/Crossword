import './style.css';
import { initHost } from './host-app';
import { initPlayer } from './player-app';

function showModeSelect(app: HTMLElement): void {
  app.innerHTML = `
    <div class="screen mode-select">
      <h1>🔤 Kreuzwortspiel</h1>
      <p class="subtitle">Multiplayer für lokales WLAN</p>
      <div class="mode-buttons">
        <button class="btn btn-mode btn-host" id="btn-host">
          <span class="mode-icon">🖥️</span>
          <span class="mode-label">Ich bin der Host</span>
          <span class="mode-desc">Spielfeld anzeigen, Spiel verwalten</span>
        </button>
        <button class="btn btn-mode btn-player" id="btn-player">
          <span class="mode-icon">📱</span>
          <span class="mode-label">Ich bin ein Spieler</span>
          <span class="mode-desc">Mit Smartphone beitreten</span>
        </button>
      </div>
    </div>
  `;

  document.getElementById('btn-host')?.addEventListener('click', () => {
    localStorage.setItem('cwMode', 'host');
    initHost(app);
  });

  document.getElementById('btn-player')?.addEventListener('click', () => {
    localStorage.setItem('cwMode', 'player');
    initPlayer(app);
  });
}

const app = document.getElementById('app')!;
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get('mode') ?? localStorage.getItem('cwMode') ?? 'select';

if (mode === 'host') {
  initHost(app);
} else if (mode === 'player') {
  initPlayer(app);
} else {
  showModeSelect(app);
}
