import { useEffect, useState, useCallback } from 'react';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

/**
 * FCM 푸시 알림 훅 (인증 상태 연동 2-Phase 구조)
 * 
 * Phase 1: 토큰 발급 — 로그인 여부와 무관하게 실행, State에만 저장
 * Phase 2: 토큰 서버 전송 — isAuthenticated가 true일 때만 실행
 * 
 * @param isAuthenticated 인증 상태 (!!user)
 */
export const usePushNotifications = (isAuthenticated: boolean) => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [tokenSentToServer, setTokenSentToServer] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // === Phase 1: FCM 토큰 발급 + 이벤트 리스너 (로그인 여부 무관) ===
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications are only available in native app environments.');
      return;
    }

    const initPushNotifications = async () => {
      try {
        const permission = await PushNotifications.requestPermissions();
        if (permission.receive === 'granted') {
          await PushNotifications.register();
        } else {
          console.warn('Push notification permission denied by user.');
        }
      } catch (error) {
        console.error('Error initializing push notifications', error);
      }
    };

    initPushNotifications();

    // 등록 성공: FCM 토큰을 State에만 저장 (서버 전송은 Phase 2에서)
    const registrationListener = PushNotifications.addListener(
      'registration',
      (token: Token) => {
        console.log('✅ Push registration success, token: ' + token.value.substring(0, 10) + '...');
        setFcmToken(token.value);
        setTokenSentToServer(false); // 토큰 로테이션 대응: 새 토큰이면 다시 서버에 보내야 함
      }
    );

    // 등록 실패
    const registrationErrorListener = PushNotifications.addListener(
      'registrationError',
      (error: any) => {
        console.error('❌ Push registration error:', JSON.stringify(error));
      }
    );

    // 포그라운드 알림 수신 (앱이 켜져 있을 때)
    const pushReceivedListener = PushNotifications.addListener(
      'pushNotificationReceived',
      (notification) => {
        console.log('🔔 Push received:', JSON.stringify(notification));
        // iOS는 presentationOptions가 네이티브 배너를 띄우므로 토스트 생략 (이중 알림 방지)
        if (Capacitor.getPlatform() !== 'ios') {
          toast({
            title: notification.title || '알림',
            description: notification.body || '',
          });
        }
      }
    );

    // 사용자가 푸시를 터치해서 앱을 열었을 때 (딥링크)
    const pushActionPerformedListener = PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (notification) => {
        console.log('👆 Push action performed:', JSON.stringify(notification));
        const actionUrl = notification.notification?.data?.action_url;
        if (actionUrl) {
          setLocation(actionUrl);
        }
      }
    );

    return () => {
      registrationListener.then(listener => listener.remove());
      registrationErrorListener.then(listener => listener.remove());
      pushReceivedListener.then(listener => listener.remove());
      pushActionPerformedListener.then(listener => listener.remove());
    };
  }, [setLocation, toast]);

  // === Phase 2: 로그인 되면 토큰을 서버에 전송 ===
  useEffect(() => {
    if (isAuthenticated && fcmToken && !tokenSentToServer) {
      const sendTokenToServer = async () => {
        try {
          const deviceType = Capacitor.getPlatform();
          const response = await fetch('/api/users/device-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: fcmToken, deviceType }),
          });

          if (response.ok) {
            setTokenSentToServer(true);
            console.log('✅ Device token sent to server successfully');
          } else {
            console.error('❌ Server rejected token:', response.status);
            // 500ms 후 1회 재시도
            setTimeout(async () => {
              try {
                const retryResp = await fetch('/api/users/device-token', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token: fcmToken, deviceType }),
                });
                if (retryResp.ok) {
                  setTokenSentToServer(true);
                  console.log('✅ Device token sent on retry');
                }
              } catch (retryErr) {
                console.error('❌ Token retry failed:', retryErr);
              }
            }, 500);
          }
        } catch (error) {
          console.error('❌ Failed to send device token to server:', error);
        }
      };

      sendTokenToServer();
    }
  }, [isAuthenticated, fcmToken, tokenSentToServer]);

  // === 계정 스위칭 대응: 로그아웃 시 전송 플래그 리셋 ===
  useEffect(() => {
    if (!isAuthenticated) {
      setTokenSentToServer(false);
    }
  }, [isAuthenticated]);

  return { fcmToken };
};
