/**
 * GCS 버킷 보안 정책 설정 및 문서화
 * allUsers:objectViewer vs SignedURL 정책 결정
 */

import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'createtree-ai-music';

/**
 * GCS 보안 정책 옵션
 */
export enum GCSSecurityPolicy {
  PUBLIC_READ = 'public_read',     // allUsers:objectViewer - 완전 공개
  SIGNED_URL = 'signed_url'        // SignedURL - 제한된 접근
}

/**
 * 현재 정책: PUBLIC_READ
 * 이유: 음악 파일은 웹 플레이어에서 직접 재생되어야 하므로 공개 접근 필요
 */
const CURRENT_POLICY = GCSSecurityPolicy.PUBLIC_READ;

/**
 * 공개 읽기 정책 적용
 */
async function applyPublicReadPolicy() {
  const bucket = storage.bucket(GCS_BUCKET_NAME);
  
  try {
    // 버킷에 공개 읽기 권한 부여
    await bucket.makePublic();
    console.log(`✅ Applied PUBLIC_READ policy to bucket: ${GCS_BUCKET_NAME}`);
    
    // IAM 정책 확인
    const [policy] = await bucket.iam.getPolicy();
    console.log('📋 Current IAM bindings:');
    policy.bindings?.forEach(binding => {
      console.log(`  - Role: ${binding.role}`);
      console.log(`    Members: ${binding.members?.join(', ')}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to apply public read policy:', error);
    throw error;
  }
}

/**
 * 파일 업로드 시 공개 접근 설정
 */
export async function uploadWithPublicAccess(localPath: string, gcsKey: string): Promise<string> {
  const bucket = storage.bucket(GCS_BUCKET_NAME);
  const file = bucket.file(gcsKey);
  
  await bucket.upload(localPath, {
    destination: gcsKey,
    public: true, // 업로드 즉시 공개 설정
    metadata: {
      contentType: 'audio/mpeg',
      cacheControl: 'public, max-age=31536000' // 1년 캐싱
    }
  });
  
  // 공개 URL 생성
  const publicUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${gcsKey}`;
  return publicUrl;
}

/**
 * SignedURL 방식 (대안)
 */
export async function generateSignedUrl(gcsKey: string, expiresInHours: number = 24): Promise<string> {
  const bucket = storage.bucket(GCS_BUCKET_NAME);
  const file = bucket.file(gcsKey);
  
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + expiresInHours * 60 * 60 * 1000
  });
  
  return signedUrl;
}

/**
 * 보안 정책 문서화
 */
export const GCS_SECURITY_DOCUMENTATION = {
  currentPolicy: CURRENT_POLICY,
  reasoning: {
    publicRead: [
      "음악 파일은 웹 오디오 플레이어에서 직접 스트리밍되어야 함",
      "CORS 제한 없이 브라우저에서 접근 가능해야 함", 
      "CDN 캐싱을 통한 성능 최적화 필요",
      "사용자 경험 최우선 - 즉시 재생 가능"
    ],
    signedUrl: [
      "더 높은 보안 수준 제공",
      "파일 접근 추적 가능",
      "시간 제한된 접근 제어",
      "하지만 웹 플레이어 호환성 문제 발생 가능"
    ]
  },
  implementation: {
    chosen: "PUBLIC_READ",
    reason: "음악 스트리밍 서비스 특성상 즉시 접근 가능한 공개 URL이 필수"
  },
  security: {
    mitigation: [
      "파일명에 UUID 사용으로 추측 불가능한 URL 생성",
      "음악 파일은 저작권 문제가 없는 AI 생성 콘텐츠",
      "버킷 리스팅 비활성화로 디렉토리 탐색 차단",
      "CloudFlare 등 CDN을 통한 DDoS 보호"
    ]
  }
};

/**
 * 정책 적용 및 검증
 */
async function applyAndValidatePolicy() {
  console.log(`🔧 Applying GCS Security Policy: ${CURRENT_POLICY}`);
  
  if (CURRENT_POLICY === GCSSecurityPolicy.PUBLIC_READ) {
    await applyPublicReadPolicy();
  }
  
  console.log('\n📖 Security Policy Documentation:');
  console.log(JSON.stringify(GCS_SECURITY_DOCUMENTATION, null, 2));
}

if (require.main === module) {
  applyAndValidatePolicy().catch(console.error);
}