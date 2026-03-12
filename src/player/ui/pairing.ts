import { Html5Qrcode } from 'html5-qrcode';
import QRCode from 'qrcode';
import type { QRPayload } from '../../shared/types';

let activeScanner: Html5Qrcode | null = null;

export async function startOfferScanner(
  containerId: string,
  onScanned: (payload: QRPayload) => void
): Promise<void> {
  if (activeScanner) {
    try { await activeScanner.stop(); } catch { /* ignore */ }
    activeScanner = null;
  }

  const scanner = new Html5Qrcode(containerId);
  activeScanner = scanner;

  await scanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    (decodedText) => {
      try {
        const payload = JSON.parse(decodedText) as QRPayload;
        if (payload.v === 1 && payload.type === 'offer') {
          stopOfferScanner().then(() => onScanned(payload));
        }
      } catch { /* ignore */ }
    },
    () => { /* ignore */ }
  );
}

export async function stopOfferScanner(): Promise<void> {
  if (activeScanner) {
    try { await activeScanner.stop(); } catch { /* ignore */ }
    activeScanner = null;
  }
}

export async function displayAnswerQR(container: HTMLElement, payload: QRPayload): Promise<void> {
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.className = 'qr-canvas';
  container.appendChild(canvas);
  const jsonStr = JSON.stringify(payload);
  await QRCode.toCanvas(canvas, jsonStr, { width: 280, errorCorrectionLevel: 'L' });
}

export function renderPlayerPairingUI(container: HTMLElement, step: 'scan-offer' | 'show-answer' | 'connected'): void {
  container.innerHTML = '';

  if (step === 'scan-offer') {
    container.innerHTML = `
      <div class="pairing-player">
        <h2>Spiel beitreten</h2>
        <p>Scanne den QR-Code auf dem Host-Gerät</p>
        <div id="offer-scanner-container" class="scanner-container"></div>
      </div>
    `;
  } else if (step === 'show-answer') {
    container.innerHTML = `
      <div class="pairing-player">
        <h2>Verbindung herstellen</h2>
        <p>Zeige diesen QR-Code dem Host</p>
        <div id="answer-qr-container" class="qr-container"></div>
        <p class="pairing-hint">Warte, bis der Host deinen Code gescannt hat…</p>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="pairing-player connected">
        <h2>✅ Verbunden!</h2>
        <p>Warte auf Spielstart…</p>
      </div>
    `;
  }
}
