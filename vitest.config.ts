import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(process.cwd(), 'src/shared'),
      '@main': path.resolve(process.cwd(), 'src/main'),
      '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: [
        'src/renderer/capture/highQualityCapture.ts',
        'src/renderer/capture/captureOrchestrator.ts',
        'src/renderer/capture/nativeWebRtcPreview.ts',
        'src/renderer/components/Preview/fullscreenToolbarVisibility.ts',
        'src/main/capture/ffmpegCapture.ts',
        'src/main/processor/imageCompressor.ts',
        'src/main/processor/captureImageProcessor.ts',
        'src/renderer/capture/regionGeometry.ts',
        'src/renderer/capture/regionKeyboard.ts',
        'src/shared/imageQuality.ts',
        'src/shared/nativeCapture.ts',
        'src/main/capture/nativeSidecarProtocol.ts',
        'src/main/capture/nativeSidecarManager.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
