import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.receiptscanner.app',
  appName: 'Receipt Scanner',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    Camera: {
      presentationStyle: 'fullscreen',
    },
  },
};

export default config;
