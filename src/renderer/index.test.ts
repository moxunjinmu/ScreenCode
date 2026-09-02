import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Renderer 内容安全策略', () => {
  it('允许连接 sidecar 返回的 127.0.0.1 随机 WebSocket 端口', () => {
    const html = fs.readFileSync(
      path.join(process.cwd(), 'src', 'renderer', 'index.html'),
      'utf8',
    );

    expect(html).toContain("connect-src 'self' https://api.anthropic.com ws://localhost:* ws://127.0.0.1:*");
  });
});
