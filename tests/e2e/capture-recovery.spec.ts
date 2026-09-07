import { test, expect } from '@playwright/test';
import { DEFAULT_CONFIG, type NativeCaptureDevice } from '../../src/shared/types';

const device: NativeCaptureDevice = {
  id: 'mf:test-card', label: 'USB3 Video', backend: 'gstreamer-mf',
  formats: [
    {
      id: 'YUY2', label: 'YUY2 4:2:2', mediaType: 'video/x-raw',
      modes: [
        { id: 'YUY2:2560x1440:50/1', width: 2560, height: 1440, frameRateNumerator: 50, frameRateDenominator: 1, advertised: true, verified: true },
        { id: 'YUY2:1920x1080:60/1', width: 1920, height: 1080, frameRateNumerator: 60, frameRateDenominator: 1, advertised: true, verified: true },
        { id: 'YUY2:1920x1080:30/1', width: 1920, height: 1080, frameRateNumerator: 30, frameRateDenominator: 1, advertised: true, verified: true },
      ],
    },
    {
      id: 'NV12', label: 'NV12 4:2:0', mediaType: 'video/x-raw',
      modes: [{ id: 'NV12:3840x2160:30/1', width: 3840, height: 2160, frameRateNumerator: 30, frameRateDenominator: 1, advertised: true, verified: true }],
    },
  ],
};

test('缓存先展示、自动连接、嵌套选择并跨页面重启恢复整套参数', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const selection = { deviceId: device.id, formatId: 'NV12', modeId: 'NV12:3840x2160:30/1' };
  const config = {
    ...DEFAULT_CONFIG,
    lastDeviceId: 'browser-card', lastNativeDeviceId: device.id,
    captureBackend: 'gstreamer-mf' as const,
    nativeCaptureSelection: selection,
    nativeCaptureProfiles: {
      [device.id]: {
        nativeDeviceId: device.id, nativeDeviceLabel: device.label,
        browserDeviceId: 'browser-card', captureBackend: 'gstreamer-mf' as const,
        selection, capabilities: device,
      },
    },
  };

  // 仅替换硬件/IPC 边界，实际 Store、Preview、Radix 浮层和 CSS 均使用产品代码。
  await page.addInitScript(({ device, config }) => {
    let savedConfig = JSON.parse(localStorage.getItem('capture-e2e-config') || 'null') || config;
    let release: () => void;
    const nativeReady = new Promise<void>((resolve) => { release = resolve; });
    const starts: unknown[] = [];
    Object.defineProperty(window, '__captureTest', {
      value: { release: () => release(), starts },
    });
    Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
      value: async () => [{ deviceId: 'browser-card', kind: 'videoinput', label: 'USB3 Video (345f:2133)' }],
    });
    Object.defineProperty(window, 'electronAPI', {
      value: new Proxy({
        getConfig: async () => savedConfig,
        setConfig: async (patch: unknown) => {
          savedConfig = { ...savedConfig, ...(patch as object) };
          localStorage.setItem('capture-e2e-config', JSON.stringify(savedConfig));
        },
        enumerateNativeCaptureDevices: async () => { await nativeReady; return [device]; },
        startNativeCapture: async (value: unknown) => { starts.push(value); },
      }, {
        get: (target, key) => key in target
          ? target[key as keyof typeof target]
          : String(key).startsWith('on') ? () => () => undefined : async () => undefined,
      }),
    });
  }, { device, config });

  await page.goto('/');
  await expect(page.getByRole('combobox', { name: '采集设备' })).toContainText('USB3 Video');
  await page.getByRole('button', { name: '采集参数', exact: true }).click();
  const format = page.getByRole('combobox', { name: '原始采集协议' });
  const resolution = page.getByRole('combobox', { name: '原始采集分辨率' });
  const fps = page.getByRole('combobox', { name: '原始采集帧率' });
  await expect(format).toContainText('NV12');
  await expect(resolution).toContainText('3840×2160');
  await expect(format).toBeDisabled();
  expect(await page.evaluate(() => (window as any).__captureTest.starts.length)).toBe(0);
  await page.evaluate(() => (window as any).__captureTest.release());
  await expect(format).toBeEnabled();
  await expect.poll(() => page.evaluate(() => (window as any).__captureTest.starts)).toEqual([selection]);
  await expect(page.getByRole('combobox', { name: '采集后端' })).toHaveCount(0);
  await expect(page.getByText('浏览器自动', { exact: true })).toHaveCount(0);

  await format.click();
  const option = page.getByRole('option', { name: 'YUY2 4:2:2' });
  await expect(option).toBeVisible();
  expect(await page.locator('.select-popover').evaluate((element) => Number(getComputedStyle(element).zIndex)))
    .toBeGreaterThan(await page.locator('.capture-toolbar-popover').evaluate((element) => Number(getComputedStyle(element).zIndex)));
  await page.screenshot({ path: testInfo.outputPath('下拉列表.png') });
  // 可见不代表没被外层浮层遮挡；核验真实命中元素并用常规点击触发选择。
  await expect.poll(() => option.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
  })).toBe(true);
  await option.click();
  await expect(format).toContainText('YUY2');
  await resolution.click();
  await page.getByRole('option', { name: '1920×1080' }).click();
  await fps.click();
  await page.getByRole('option', { name: '30 FPS · 已验证', exact: true }).click();
  await expect(fps).toContainText('30 FPS');
  await page.screenshot({ path: testInfo.outputPath('精确参数.png') });

  await page.reload();
  await page.getByRole('button', { name: '采集参数', exact: true }).click();
  await expect(format).toContainText('YUY2');
  await expect(resolution).toContainText('1920×1080');
  await expect(fps).toContainText('30 FPS');
  await page.evaluate(() => (window as any).__captureTest.release());
  await expect.poll(() => page.evaluate(() => (window as any).__captureTest.starts)).toEqual([
    { deviceId: device.id, formatId: 'YUY2', modeId: 'YUY2:1920x1080:30/1' },
  ]);
  await fps.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: '30 FPS · 已验证', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('option', { name: '60 FPS · 已验证', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(fps).toContainText('60 FPS');
  expect(errors).toEqual([]);
});
