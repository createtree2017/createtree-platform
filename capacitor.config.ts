import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.createtree.app',
  appName: 'createtree',
  webDir: 'dist',
  server: {
    // 앱이 실행될 때 로컬 번들 대신 Railway 라이브 서버를 띄움
    url: 'https://createtree.com', // 실제 배포된 URL로 변경 필요시 수정
    cleartext: true
  },
  android: {
    buildOptions: {
      keystorePassword: '',
      keystoreAlias: '',
      keystoreAliasPassword: '',
    }
  }
};

export default config;
