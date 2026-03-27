import admin from 'firebase-admin';

let firebaseAdmin: admin.app.App | null = null;

/**
 * Firebase Admin SDK 초기화 및 반환
 * 싱글톤 패턴으로 구현하여 중복 초기화 방지
 */
export function getFirebaseAdmin(): admin.app.App {
    if (firebaseAdmin) {
        return firebaseAdmin;
    }

    // 이미 다른 곳(server/firebase.ts 등)에서 초기화된 Firebase 앱이 있으면 재사용 (이중 초기화 방지)
    if (admin.apps.length > 0 && admin.apps[0]) {
        firebaseAdmin = admin.apps[0];
        console.log('✅ 기존에 초기화된 Firebase Admin (Default App) 재사용');
        return firebaseAdmin;
    }

    try {
        // 환경변수에서 Firebase 설정 로드
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

        if (!serviceAccount) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT 또는 GOOGLE_APPLICATION_CREDENTIALS_JSON 환경변수가 설정되지 않았습니다.');
        }

        // JSON 파싱
        const serviceAccountKey = JSON.parse(serviceAccount);

        // Firebase Admin 초기화
        firebaseAdmin = admin.initializeApp({
            credential: admin.credential.cert(serviceAccountKey),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
        });

        console.log('✅ Firebase Admin SDK 초기화 성공');
        return firebaseAdmin;
    } catch (error) {
        console.error('❌ Firebase Admin SDK 초기화 실패:', error);
        throw error;
    }
}

/**
 * Firebase Admin 인스턴스 반환 (이미 초기화된 경우)
 */
export function getFirebaseAdminInstance(): admin.app.App | null {
    return firebaseAdmin;
}

/**
 * Firebase Storage 버킷 반환
 */
export function getFirebaseStorage(): admin.storage.Storage {
    const app = getFirebaseAdmin();
    return app.storage();
}

/**
 * Firebase Firestore 인스턴스 반환
 */
export function getFirebaseFirestore(): admin.firestore.Firestore {
    const app = getFirebaseAdmin();
    return app.firestore();
}

/**
 * Firebase Auth 인스턴스 반환
 */
export function getFirebaseAuth(): admin.auth.Auth {
    const app = getFirebaseAdmin();
    return app.auth();
}

/**
 * Firebase Cloud Messaging 인스턴스 반환 (FCM 푸시 발송용)
 */
export function getFirebaseMessaging(): admin.messaging.Messaging {
    const app = getFirebaseAdmin();
    return app.messaging();
}
