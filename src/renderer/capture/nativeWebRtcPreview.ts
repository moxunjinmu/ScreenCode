import GstWebRTCAPI from '../vendor/gstwebrtc-api/gstwebrtc-api-3.0.0.esm.js';

export interface NativePreviewConnection {
  close: () => void;
}

interface ConnectNativePreviewOptions {
  signallingUrl: string;
  onStream: (stream: MediaStream) => void;
  onError: (message: string) => void;
}

/** 使用 GStreamer 官方客户端连接唯一的 ScreenCode producer。 */
export function connectNativePreview(
  options: ConnectNativePreviewOptions,
): NativePreviewConnection {
  const api = new GstWebRTCAPI({
    meta: { name: 'ScreenCode Renderer' },
    signalingServerUrl: options.signallingUrl,
    reconnectionTimeout: 1_000,
    webrtcConfig: { iceServers: [], bundlePolicy: 'max-bundle' },
  });
  let session: ReturnType<GstWebRTCAPI['createConsumerSession']> = null;
  let closed = false;

  const connectProducer = (producer: { id: string; meta: Record<string, unknown> }) => {
    if (closed || session) return;
    session = api.createConsumerSession(producer.id);
    if (!session) {
      options.onError('无法创建 GStreamer WebRTC 消费会话');
      return;
    }
    session.addEventListener('error', (event) => {
      const detail = event as ErrorEvent;
      options.onError(detail.message || 'GStreamer WebRTC 预览失败');
    });
    session.addEventListener('streamsChanged', () => {
      const stream = session?.streams[0];
      if (stream) options.onStream(stream);
    });
    if (!session.connect()) {
      options.onError('GStreamer WebRTC 会话连接失败');
    }
  };

  const connectionListener = {
    connected: () => api.getAvailableProducers().forEach(connectProducer),
    disconnected: () => {
      if (!closed) options.onError('GStreamer WebRTC 信令已断开');
    },
  };
  const peerListener = { producerAdded: connectProducer };
  api.registerConnectionListener(connectionListener);
  api.registerPeerListener(peerListener);

  return {
    close: () => {
      closed = true;
      session?.close();
      session = null;
      api.unregisterConnectionListener(connectionListener);
      api.unregisterPeerListener(peerListener);
    },
  };
}
