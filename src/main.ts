import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { initHost } from './host-app';
import { initPlayer } from './player-app';

// Register the service worker. With registerType:'autoUpdate' the SW already
// calls skipWaiting() automatically, which triggers a controllerchange event
// that reloads the page. The onRegisteredSW hook adds a periodic re-check so
// that long-running sessions (e.g. a game left open for hours) also pick up a
// new deployment without the user having to manually reload.
registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    if (!registration) return;
    const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
    setInterval(async () => {
      if (registration.installing) return; // already updating
      if (!navigator.onLine) return; // no network
      try {
        const resp = await fetch(swUrl, {
          cache: 'no-store',
          headers: { 'cache-control': 'no-cache' },
        });
        if (resp.status === 200) {
          await registration.update();
        }
      } catch { /* ignore network errors during background check */ }
    }, CHECK_INTERVAL_MS);
  },
});

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
