import type { HostMessage, ClientMessage, QRPayload } from '../shared/types';
import { compressSDP, decompressSDP } from '../shared/compression';
import { generateId } from '../shared/constants';

export type PlayerConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected';

export class WebRTCPlayer {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private peerId: string = '';
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  onMessage: ((msg: HostMessage) => void) | null = null;
  onStateChange: ((state: PlayerConnectionState) => void) | null = null;

  async connectFromOffer(offerPayload: QRPayload): Promise<QRPayload> {
    this.peerId = offerPayload.peerId;
    this.pc = new RTCPeerConnection({ iceServers: [] });

    this.pc.addEventListener('datachannel', (event) => {
      this.dc = event.channel;
      this.setupDataChannel();
    });

    this.pc.addEventListener('connectionstatechange', () => {
      if (this.pc?.connectionState === 'failed' || this.pc?.connectionState === 'closed') {
        this.onStateChange?.('disconnected');
        this.stopPing();
      }
    });

    const sdp = decompressSDP(offerPayload.sdp);
    await this.pc.setRemoteDescription({ type: 'offer', sdp });
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    await this.waitForICEGathering();

    const answerSdp = compressSDP(this.pc.localDescription!.sdp);
    const answerPayload: QRPayload = {
      v: 1,
      type: 'answer',
      gameId: offerPayload.gameId,
      peerId: this.peerId,
      sdp: answerSdp,
    };

    return answerPayload;
  }

  send(msg: ClientMessage): void {
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify(msg));
    }
  }

  disconnect(): void {
    this.stopPing();
    this.dc?.close();
    this.pc?.close();
    this.dc = null;
    this.pc = null;
  }

  isConnected(): boolean {
    return this.dc?.readyState === 'open';
  }

  private setupDataChannel(): void {
    if (!this.dc) return;

    this.dc.addEventListener('open', () => {
      this.onStateChange?.('connected');
      this.startPing();
    });

    this.dc.addEventListener('close', () => {
      this.onStateChange?.('disconnected');
      this.stopPing();
    });

    this.dc.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data as string) as HostMessage;
        if (msg.type === 'pong') return;
        this.onMessage?.(msg);
      } catch { /* ignore */ }
    });
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.dc?.readyState === 'open') {
        this.dc.send(JSON.stringify({ type: 'ping' }));
      }
    }, 5000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private waitForICEGathering(): Promise<void> {
    return new Promise(resolve => {
      if (!this.pc) { resolve(); return; }
      if (this.pc.iceGatheringState === 'complete') { resolve(); return; }
      const handler = () => {
        if (this.pc?.iceGatheringState === 'complete') {
          this.pc?.removeEventListener('icegatheringstatechange', handler);
          resolve();
        }
      };
      this.pc.addEventListener('icegatheringstatechange', handler);
      setTimeout(resolve, 10000);
    });
  }
}
