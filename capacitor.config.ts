import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.receiptscannerpro.app',
  appName: 'ParserPro',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    Camera: {
      presentationStyle: 'fullscreen',
    },
    SystemBars: {
      insetsHandling: 'native',
      style: 'DEFAULT',
      hidden: false,
    },
  },
};

export default config;
