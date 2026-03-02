import { useEffect, useState } from 'react';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

export const usePushNotifications = () => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  useEffect(() => {
    // 앱(안드로이드/iOS) 환경에서만 푸시 알림 플러그인을 초기화합니다.
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications are only available in native app environments.');
      return;
    }

    const initPushNotifications = async () => {
      try {
        // 1. 푸시 알림 권한 요청 (최초 앱 실행 시 팝업 뜸)
        const permission = await PushNotifications.requestPermissions();

        if (permission.receive === 'granted') {
          // 2. 권한 수락 시 기기를 FCM(Firebase) 서버에 등록
          await PushNotifications.register();
        } else {
          console.warn('Push notification permission denied by user.');
        }
      } catch (error) {
        console.error('Error initializing push notifications', error);
      }
    };

    initPushNotifications();

    // --- 이벤트 리스너 등록 ---

    // 등록 성공: FCM 토큰 수신
    const registrationListener = PushNotifications.addListener(
      'registration',
      async (token: Token) => {
        console.log('✅ Push registration success, token: ' + token.value);
        setFcmToken(token.value);

        // 🚀 백엔드 연동: 발급받은 FCM 토큰을 서버에 저장
        try {
          const deviceType = Capacitor.getPlatform(); // 'web', 'ios', 'android'

          await fetch('/api/users/device-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              token: token.value,
              deviceType: deviceType,
            }),
          });
          console.log('✅ Device token sent to server successfully');
        } catch (error) {
          console.error('❌ Failed to send device token to server:', error);
        }
      }
    );

    // 등록 실패
    const registrationErrorListener = PushNotifications.addListener(
      'registrationError',
      (error: any) => {
        console.error('❌ Push registration error: ', JSON.stringify(error));
      }
    );

    // 앱이 포그라운드(켜져 있는 상태)에서 알림을 수신했을 때
    const pushReceivedListener = PushNotifications.addListener(
      'pushNotificationReceived',
      (notification) => {
        console.log('🔔 Push received: ' + JSON.stringify(notification));
        // TODO: 앱 내에 커스텀 토스트 알림을 띄우는 등 UI 처리 가능
      }
    );

    // 사용자가 푸시 알림(상단 바)을 터치하여 앱을 열었을 때
    const pushActionPerformedListener = PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (notification) => {
        console.log('👆 Push action performed: ' + JSON.stringify(notification));
        // TODO: notification.data 에 들어있는 url 등으로 페이지 이동 (라우팅) 처리
      }
    );

    return () => {
      // 컴포넌트 언마운트 시 리스너 정리
      registrationListener.then(listener => listener.remove());
      registrationErrorListener.then(listener => listener.remove());
      pushReceivedListener.then(listener => listener.remove());
      pushActionPerformedListener.then(listener => listener.remove());
    };
  }, []);

  return { fcmToken };
};
