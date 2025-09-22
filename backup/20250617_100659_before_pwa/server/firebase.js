import admin from 'firebase-admin';
import fs from 'fs';

// Firebase Admin 초기화 - JSON 파일에서 직접 로드
let serviceAccount;
try {
  serviceAccount = JSON.parse(fs.readFileSync('./attached_assets/createtree-5ae3581cc6a4.json', 'utf8'));
} catch (error) {
  console.error('Firebase 서비스 계정 키 파일을 읽을 수 없습니다:', error);
  throw error;
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'createtree-upload'
  });
}

const bucket = admin.storage().bucket();

export { admin, bucket };