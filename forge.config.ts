import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'ScreenCode',
    appBundleId: 'com.screencode.app',
    win32metadata: {
      CompanyName: 'ScreenCode Team',
      FileDescription: 'Screen capture and code extraction tool',
      OriginalFilename: 'ScreenCode.exe',
      ProductName: 'ScreenCode',
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'ScreenCode',
      authors: 'ScreenCode Team',
      description: 'Screen capture and code extraction tool',
    }),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          // Main process
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          // Preload scripts
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
