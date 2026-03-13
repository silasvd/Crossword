import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import type { QRPayload } from '../../shared/types';

export interface PairingSlot {
  index: number;
  peerId: string;
  offerPayload: QRPayload;
  state: 'waiting-scan' | 'waiting-answer' | 'connected';
}

let activeScanner: Html5Qrcode | null = null;

export async function displayOfferQR(container: HTMLElement, payload: QRPayload): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.className = 'qr-canvas';
  container.appendChild(canvas);
  const jsonStr = JSON.stringify(payload);
  await QRCode.toCanvas(canvas, jsonStr, { width: 280, errorCorrectionLevel: 'L' });
}

export async function startAnswerScanner(
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
        if (payload.v === 1 && payload.type === 'answer') {
          stopScanner().then(() => onScanned(payload));
        }
      } catch { /* ignore */ }
    },
    () => { /* ignore errors */ }
  );
}

export async function stopScanner(): Promise<void> {
  if (activeScanner) {
    try { await activeScanner.stop(); } catch { /* ignore */ }
    activeScanner = null;
  }
}

export function renderPairingUI(
  container: HTMLElement,
  slots: PairingSlot[],
  onScanAnswer: (slotIndex: number) => void,
  onBack?: () => void
): void {
  container.innerHTML = `
    <div class="pairing-ui">
      <h2>Spieler verbinden</h2>
      <p class="pairing-hint">Jeder Spieler scannt den QR-Code auf diesem Gerät, dann zeigt sein Gerät einen QR-Code, den du hier scannst.</p>
      <div class="pairing-slots">
        ${slots.map(slot => `
          <div class="pairing-slot ${slot.state}" data-index="${slot.index}">
            <h3>Spieler ${slot.index + 1}</h3>
            <div class="qr-offer-container" id="qr-offer-${slot.index}"></div>
            <div class="slot-status">
              ${slot.state === 'waiting-scan' ? `
                <p>Spieler soll diesen QR-Code scannen</p>
                <button class="btn btn-scan" data-index="${slot.index}">📷 Antwort scannen</button>
              ` : slot.state === 'waiting-answer' ? `
                <p>Warte auf Antwort-QR...</p>
                <div id="scanner-container-${slot.index}" class="scanner-container"></div>
              ` : `
                <p class="connected-badge">✅ Verbunden</p>
              `}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  container.querySelectorAll('.btn-scan').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt((btn as HTMLElement).dataset.index ?? '0', 10);
      onScanAnswer(idx);
    });
  });

  if (onBack) {
    const pairingDiv = container.querySelector('.pairing-ui');
    if (pairingDiv) {
      const backBtn = document.createElement('button');
      backBtn.className = 'btn btn-back';
      backBtn.textContent = '← Zurück';
      backBtn.addEventListener('click', onBack);
      pairingDiv.appendChild(backBtn);
    }
  }
}
