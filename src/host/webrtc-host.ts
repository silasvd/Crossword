import type { ClientMessage, HostMessage } from '../shared/types';
import { compressSDP, decompressSDP } from '../shared/compression';
import type { QRPayload } from '../shared/types';
import { generateId } from '../shared/constants';

export type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected';

export interface PeerSlot {
  peerId: string;
  playerIndex: number;
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  state: ConnectionState;
  onMessage: ((msg: ClientMessage) => void) | null;
  onStateChange: ((state: ConnectionState) => void) | null;
  offerPayload: QRPayload | null;
}

export class WebRTCHost {
  private peers: Map<string, PeerSlot> = new Map();
  private gameId: string;
  private onMessage: (peerId: string, msg: ClientMessage) => void;
  private onConnectionChange: (peerId: string, state: ConnectionState) => void;

  constructor(
    gameId: string,
    onMessage: (peerId: string, msg: ClientMessage) => void,
    onConnectionChange: (peerId: string, state: ConnectionState) => void
  ) {
    this.gameId = gameId;
    this.onMessage = onMessage;
    this.onConnectionChange = onConnectionChange;
  }

  async createPeerOffer(playerIndex: number): Promise<{ peerId: string; payload: QRPayload }> {
    const peerId = generateId(8);
    const pc = new RTCPeerConnection({ iceServers: [] });
    const dc = pc.createDataChannel('game', { ordered: true });

    const slot: PeerSlot = {
      peerId,
      playerIndex,
      pc,
      dc,
      state: 'new',
      onMessage: null,
      onStateChange: null,
      offerPayload: null,
    };
    this.peers.set(peerId, slot);

    this.setupDataChannel(peerId, dc);
    this.setupPCListeners(peerId, pc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await this.waitForICEGathering(pc);

    const sdpCompressed = compressSDP(pc.localDescription!.sdp);
    const payload: QRPayload = {
      v: 1,
      type: 'offer',
      gameId: this.gameId,
      peerId,
      sdp: sdpCompressed,
    };
    slot.offerPayload = payload;

    return { peerId, payload };
  }

  async acceptAnswer(answerPayload: QRPayload): Promise<void> {
    const slot = this.peers.get(answerPayload.peerId);
    if (!slot) {
      throw new Error(`Unknown peerId: ${answerPayload.peerId}`);
    }

    const sdp = decompressSDP(answerPayload.sdp);
    await slot.pc.setRemoteDescription({ type: 'answer', sdp });
  }

  send(peerId: string, msg: HostMessage): void {
    const slot = this.peers.get(peerId);
    if (!slot || !slot.dc || slot.dc.readyState !== 'open') return;
    slot.dc.send(JSON.stringify(msg));
  }

  broadcast(msg: HostMessage): void {
    for (const [peerId] of this.peers) {
      this.send(peerId, msg);
    }
  }

  sendToPlayer(playerId: string, msg: HostMessage): void {
    this.send(playerId, msg);
  }

  getConnectedPeerIds(): string[] {
    return Array.from(this.peers.entries())
      .filter(([, s]) => s.state === 'connected')
      .map(([id]) => id);
  }

  getPeerIds(): string[] {
    return Array.from(this.peers.keys());
  }

  isConnected(peerId: string): boolean {
    const slot = this.peers.get(peerId);
    return slot ? slot.state === 'connected' : false;
  }

  close(peerId: string): void {
    const slot = this.peers.get(peerId);
    if (slot) {
      slot.dc?.close();
      slot.pc.close();
      this.peers.delete(peerId);
    }
  }

  closeAll(): void {
    for (const peerId of this.peers.keys()) {
      this.close(peerId);
    }
  }

  private setupDataChannel(peerId: string, dc: RTCDataChannel): void {
    dc.addEventListener('open', () => {
      const slot = this.peers.get(peerId);
      if (slot) {
        slot.state = 'connected';
        this.onConnectionChange(peerId, 'connected');
      }
    });

    dc.addEventListener('close', () => {
      const slot = this.peers.get(peerId);
      if (slot) {
        slot.state = 'disconnected';
        this.onConnectionChange(peerId, 'disconnected');
      }
    });

    dc.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ClientMessage;
        if ((msg as { type: string }).type === 'ping') {
          this.send(peerId, { type: 'pong' });
          return;
        }
        this.onMessage(peerId, msg);
      } catch {
        // ignore parse errors
      }
    });
  }

  private setupPCListeners(peerId: string, pc: RTCPeerConnection): void {
    pc.addEventListener('connectionstatechange', () => {
      const slot = this.peers.get(peerId);
      if (!slot) return;
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        slot.state = 'disconnected';
        this.onConnectionChange(peerId, 'disconnected');
      }
    });
  }

  private waitForICEGathering(pc: RTCPeerConnection): Promise<void> {
    return new Promise(resolve => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      const handler = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', handler);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', handler);
      // Timeout fallback after 10 seconds
      setTimeout(resolve, 10000);
    });
  }
}
