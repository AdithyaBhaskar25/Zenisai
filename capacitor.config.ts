import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zenisai.music',
  appName: 'Zenisai',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    App: {
      disableBackButtonHandler: false
    }
  }
};

export default config;
