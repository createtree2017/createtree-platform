import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.createtree.app',
  appName: 'createtree',
  webDir: 'dist/public',
  server: {
    // 에뮬레이터에서 개발 PC의 Vite 서버로 연결 (10.0.2.2 = 에뮬레이터에서 PC localhost)
    url: 'http://10.0.2.2:5000',
    cleartext: true
  },
  android: {
    buildOptions: {
      keystorePassword: '',
      keystoreAlias: '',
      keystoreAliasPassword: '',
    }
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
