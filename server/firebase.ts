import admin from 'firebase-admin';
import fs from 'fs';
import dotenv from 'dotenv';
import { FIREBASE_CONSTANTS, GCS_CONSTANTS } from './constants';

dotenv.config();

/**
 * 🔧 Private Key 처리 개선 함수
 * 다양한 newline 인코딩 및 PEM 형식 문제를 해결
 */
function processPrivateKey(privateKey: string): string {
  if (!privateKey) {
    throw new Error('Private key is empty or undefined');
  }

  // Private key 디버그 로그 제거 (보안)
  
  let processedKey = privateKey;
  
  // 1. 다양한 newline 인코딩 처리
  // \\n → \n → actual newline
  processedKey = processedKey.replace(/\\\\n/g, '\n'); // \\n → \n
  processedKey = processedKey.replace(/\\n/g, '\n');     // \n → actual newline
  
  // 2. 불필요한 공백 제거
  processedKey = processedKey.trim();
  
  // 3. PEM 헤더/푸터 확인 및 추가
  const pemHeader = FIREBASE_CONSTANTS.PEM.HEADER;
  const pemFooter = FIREBASE_CONSTANTS.PEM.FOOTER;
  
  if (!processedKey.includes(pemHeader)) {
    console.log('⚠️ PEM 헤더가 없음, 헤더 추가 중...');
    processedKey = `${pemHeader}\n${processedKey}`;
  }
  
  if (!processedKey.includes(pemFooter)) {
    console.log('⚠️ PEM 푸터가 없음, 푸터 추가 중...');
    processedKey = `${processedKey}\n${pemFooter}`;
  }
  
  // 4. 🔧 한 줄 PEM 키 처리 개선 (헤더+데이터+푸터가 모두 한 줄에 있는 경우 대응)
  let base64Data = '';
  
  // 헤더와 푸터 사이의 내용 직접 추출
  if (processedKey.includes(pemHeader) && processedKey.includes(pemFooter)) {
    const startIdx = processedKey.indexOf(pemHeader) + pemHeader.length;
    const endIdx = processedKey.indexOf(pemFooter);
    
    if (startIdx > 0 && endIdx > startIdx) {
      const middleContent = processedKey.substring(startIdx, endIdx);
      base64Data = middleContent.replace(FIREBASE_CONSTANTS.BASE64.REGEX, '');
    }
  }
  
  // Base64 디버그 로그 제거 (보안)
  
  if (base64Data.length === 0) {
    console.error('❌ [Firebase] Base64 데이터 추출 실패');
    console.error('📋 [Firebase] 원본 키 길이:', processedKey.length);
    console.error('📋 [Firebase] 헤더 위치:', processedKey.indexOf(pemHeader));
    console.error('📋 [Firebase] 푸터 위치:', processedKey.indexOf(pemFooter));
    throw new Error('Private key에서 Base64 데이터를 찾을 수 없습니다');
  }
  
  // 64자마다 줄바꿈으로 정규화
  const chunkSize = FIREBASE_CONSTANTS.BASE64.CHUNK_SIZE;
  const chunkRegex = new RegExp(`.{1,${chunkSize}}`, 'g');
  const formattedBase64 = base64Data.match(chunkRegex)?.join('\n') || base64Data;
  
  processedKey = `${pemHeader}\n${formattedBase64}\n${pemFooter}`;
  
  console.log('✅ Private key 처리 완료');
  
  return processedKey;
}

/**
 * 🔧 JSON 기반 credentials 처리 함수
 */
function parseJsonCredentials(jsonString: string): admin.ServiceAccount {
  try {
    const parsed = JSON.parse(jsonString);
    
    // 필수 필드 확인
    const requiredFields = ['project_id', 'private_key', 'client_email'];
    const missingFields = requiredFields.filter(field => !parsed[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`JSON credentials missing required fields: ${missingFields.join(', ')}`);
    }
    
    return {
      projectId: parsed.project_id,
      privateKeyId: parsed.private_key_id,
      privateKey: processPrivateKey(parsed.private_key),
      clientEmail: parsed.client_email,
      clientId: parsed.client_id,
    } as admin.ServiceAccount;
  } catch (error) {
    console.error('❌ JSON credentials 파싱 실패:', error);
    throw new Error(`Invalid JSON credentials: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Firebase Admin 초기화 - 개선된 다중 방식 인증
let serviceAccount: admin.ServiceAccount | string | undefined;

// 1순위: GOOGLE_APPLICATION_CREDENTIALS_JSON (통합 JSON)
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  try {
    console.log('🔄 GOOGLE_APPLICATION_CREDENTIALS_JSON 사용 시도...');
    serviceAccount = parseJsonCredentials(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    console.log('✅ Firebase JSON credentials 로드 성공');
  } catch (error) {
    console.error('❌ Firebase JSON credentials 파싱 실패:', error);
    serviceAccount = undefined;
  }
}

// 2순위: 개별 환경변수 (개선된 private key 처리)
if (!serviceAccount && process.env.GOOGLE_CLOUD_PRIVATE_KEY) {
  try {
    console.log('🔄 개별 환경변수에서 Firebase credentials 구성 중...');
    
    const requiredEnvVars = {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      clientEmail: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      privateKey: process.env.GOOGLE_CLOUD_PRIVATE_KEY
    };
    
    const missingVars = Object.entries(requiredEnvVars)
      .filter(([key, value]) => !value)
      .map(([key]) => key);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    
    serviceAccount = {
      projectId: requiredEnvVars.projectId,
      privateKeyId: process.env.GOOGLE_CLOUD_PRIVATE_KEY_ID,
      privateKey: processPrivateKey(requiredEnvVars.privateKey!),
      clientEmail: requiredEnvVars.clientEmail,
      clientId: process.env.GOOGLE_CLOUD_CLIENT_ID,
    } as admin.ServiceAccount;
    
    console.log('✅ Firebase 개별 환경변수 로드 성공');
  } catch (error) {
    console.error('❌ Firebase 개별 환경변수 처리 실패:', error);
    serviceAccount = undefined;
  }
}

// 3순위: Application Default Credentials (ADC) 시도
if (!serviceAccount) {
  try {
    console.log('🔄 Firebase ADC (Application Default Credentials) 사용 시도...');
    serviceAccount = 'ADC'; // 플래그로 ADC 사용 표시
  } catch (error) {
    console.warn('⚠️ Firebase ADC를 사용할 수 없습니다:', error instanceof Error ? error.message : String(error));
  }
}

// Firebase Admin 앱 초기화
if (serviceAccount && !admin.apps.length) {
  try {
    if (serviceAccount === 'ADC') {
      // Application Default Credentials 사용
      admin.initializeApp({
        storageBucket: GCS_CONSTANTS.BUCKET.DEFAULT_NAME
      });
      console.log('🔥 Firebase Admin ADC로 초기화 완료');
    } else {
      // 서비스 계정 기반 인증 사용 (JSON 또는 개별 환경변수)
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: GCS_CONSTANTS.BUCKET.DEFAULT_NAME
      });
      console.log('🔥 Firebase Admin 서비스 계정으로 초기화 완료');
      console.log('📦 Storage bucket:', GCS_CONSTANTS.BUCKET.DEFAULT_NAME);
    }
    
    // 초기화 검증
    const app = admin.app();
    console.log('✅ Firebase Admin 앱 초기화 검증 완료:', app.name);
    
  } catch (error) {
    console.error('❌ Firebase Admin 초기화 실패:', error);
    console.error('🔍 에러 상세:', error instanceof Error ? error.message : String(error));
    serviceAccount = undefined; // 실패시 undefined로 설정
  }
} else if (!serviceAccount) {
  console.warn('⚠️ Firebase Admin 초기화 실패 - 모든 인증 방식 실패');
  console.warn('🔧 다음 환경변수 중 하나를 설정하세요:');
  console.warn('   1. GOOGLE_APPLICATION_CREDENTIALS_JSON (권장)');
  console.warn('   2. GOOGLE_CLOUD_PRIVATE_KEY + GOOGLE_CLOUD_PROJECT_ID + GOOGLE_CLOUD_CLIENT_EMAIL');
}

// Firebase 서비스 안전하게 내보내기
import type { Bucket } from '@google-cloud/storage';

let bucket: Bucket | any;
let auth: admin.auth.Auth | any;

if (serviceAccount && admin.apps.length > 0) {
  bucket = admin.storage().bucket();
  auth = admin.auth();
} else {
  // Firebase 서비스가 없을 때를 위한 더미 객체
  bucket = {
    file: () => ({
      save: () => Promise.reject(new Error(FIREBASE_CONSTANTS.MESSAGES.ERRORS.NOT_CONFIGURED)),
      exists: () => Promise.resolve([false]),
      makePublic: () => Promise.reject(new Error(FIREBASE_CONSTANTS.MESSAGES.ERRORS.NOT_CONFIGURED))
    })
  };
  auth = {
    verifyIdToken: () => Promise.reject(new Error(FIREBASE_CONSTANTS.MESSAGES.ERRORS.NOT_CONFIGURED))
  };
}

// ES 모듈 export로 변환
export { admin, bucket, auth };
export default { admin, bucket, auth };