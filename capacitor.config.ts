import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.createtree.app',
  appName: 'createtree',
  webDir: 'dist/public',

  // Railway 프로덕션 서버에서 웹 앱을 로드 (웹 업데이트 = 앱 자동 반영)
  server: {
    url: 'https://createtree-platform-production.up.railway.app',
    cleartext: false
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
