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
        'src/main/capture/ffmpegCapture.ts',
        'src/main/processor/imageCompressor.ts',
        'src/shared/imageQuality.ts',
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
