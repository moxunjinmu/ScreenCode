interface GstWebRTCPeer {
  id: string;
  meta: Record<string, unknown>;
}

interface GstWebRTCSession extends EventTarget {
  streams: MediaStream[];
  connect(): boolean;
  close(): void;
}

interface GstWebRTCConnectionListener {
  connected(clientId: string): void;
  disconnected(): void;
}

interface GstWebRTCPeerListener {
  producerAdded?(producer: GstWebRTCPeer): void;
  producerRemoved?(producer: GstWebRTCPeer): void;
}

export default class GstWebRTCAPI {
  constructor(config?: {
    meta?: Record<string, unknown>;
    signalingServerUrl?: string;
    reconnectionTimeout?: number;
    webrtcConfig?: RTCConfiguration;
  });

  registerConnectionListener(listener: GstWebRTCConnectionListener): void;
  unregisterConnectionListener(listener: GstWebRTCConnectionListener): void;
  registerPeerListener(listener: GstWebRTCPeerListener): void;
  unregisterPeerListener(listener: GstWebRTCPeerListener): void;
  getAvailableProducers(): GstWebRTCPeer[];
  createConsumerSession(producerId: string): GstWebRTCSession | null;
}
