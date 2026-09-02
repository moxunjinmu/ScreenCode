import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeSessionShape extends EventTarget {
  streams: MediaStream[];
  connect: () => boolean;
  close: () => void;
}

interface FakeApiShape {
  config: Record<string, unknown>;
  session: FakeSessionShape;
  connectionListener: { connected: (id: string) => void; disconnected: () => void } | null;
  unregisterConnectionListener: () => void;
  unregisterPeerListener: () => void;
}

const state = vi.hoisted(() => ({
  instance: null as FakeApiShape | null,
  connectResult: true,
  sessionAvailable: true,
}));

vi.mock('../vendor/gstwebrtc-api/gstwebrtc-api-3.0.0.esm.js', () => {
  class FakeSession extends EventTarget implements FakeSessionShape {
    streams: MediaStream[] = [];
    connect = vi.fn(() => state.connectResult);
    close = vi.fn();
  }

  class FakeApi implements FakeApiShape {
    config: Record<string, unknown>;
    session = new FakeSession();
    connectionListener: FakeApiShape['connectionListener'] = null;
    peerListener: {
      producerAdded?: (producer: { id: string; meta: Record<string, unknown> }) => void;
    } | null = null;
    unregisterConnectionListener = vi.fn();
    unregisterPeerListener = vi.fn();

    constructor(config: Record<string, unknown>) {
      this.config = config;
      state.instance = this;
    }

    registerConnectionListener(listener: FakeApiShape['connectionListener']) {
      this.connectionListener = listener;
    }

    registerPeerListener(listener: FakeApi['peerListener']) {
      this.peerListener = listener;
    }

    getAvailableProducers() {
      return [{ id: 'producer-1', meta: {} }];
    }

    createConsumerSession() {
      return state.sessionAvailable ? this.session : null;
    }
  }

  return { default: FakeApi };
});

import { connectNativePreview } from './nativeWebRtcPreview';

describe('GStreamer WebRTC 预览客户端', () => {
  beforeEach(() => {
    state.instance = null;
    state.connectResult = true;
    state.sessionAvailable = true;
  });

  it('等待本地信令重连，并接入随机端口上的唯一 producer', () => {
    const onStream = vi.fn();
    const connection = connectNativePreview({
      signallingUrl: 'ws://127.0.0.1:1680',
      onStream,
      onError: vi.fn(),
    });
    const api = state.instance;
    expect(api?.config.reconnectionTimeout).toBe(1_000);

    api?.connectionListener?.connected('renderer-1');
    expect(api?.session.connect).toHaveBeenCalledOnce();
    const stream = {} as MediaStream;
    if (api) api.session.streams = [stream];
    api?.session.dispatchEvent(new Event('streamsChanged'));
    expect(onStream).toHaveBeenCalledWith(stream);

    connection.close();
    expect(api?.session.close).toHaveBeenCalledOnce();
    expect(api?.unregisterConnectionListener).toHaveBeenCalledOnce();
    expect(api?.unregisterPeerListener).toHaveBeenCalledOnce();
  });

  it('会明确报告会话创建、连接和信令断开错误', () => {
    const onError = vi.fn();
    state.sessionAvailable = false;
    const missingSession = connectNativePreview({
      signallingUrl: 'ws://127.0.0.1:1680',
      onStream: vi.fn(),
      onError,
    });
    state.instance?.connectionListener?.connected('renderer-1');
    expect(onError).toHaveBeenCalledWith('无法创建 GStreamer WebRTC 消费会话');
    missingSession.close();

    state.sessionAvailable = true;
    state.connectResult = false;
    const failedConnection = connectNativePreview({
      signallingUrl: 'ws://127.0.0.1:1681',
      onStream: vi.fn(),
      onError,
    });
    const api = state.instance;
    api?.connectionListener?.connected('renderer-2');
    expect(onError).toHaveBeenCalledWith('GStreamer WebRTC 会话连接失败');
    api?.session.dispatchEvent(new Event('error'));
    expect(onError).toHaveBeenCalledWith('GStreamer WebRTC 预览失败');
    api?.connectionListener?.disconnected();
    expect(onError).toHaveBeenCalledWith('GStreamer WebRTC 信令已断开');
    failedConnection.close();
  });
});
