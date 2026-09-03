import packageMetadata from '../../package.json';
import { describe, expect, it } from 'vitest';
import { APP_VERSION, formatAppLabel } from './appMetadata';

describe('应用版本信息', () => {
  it('始终读取当前 package.json 版本', () => {
    expect(APP_VERSION).toBe(packageMetadata.version);
    expect(formatAppLabel()).toBe(`ScreenCode ${packageMetadata.version}`);
  });
});
