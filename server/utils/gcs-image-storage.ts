import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';
import path from 'path';

/**
 * 🔧 Private Key 처리 개선 함수 - 한 줄 PEM 형식 지원
 * 다양한 newline 인코딩, 한 줄 PEM, 공백 문제를 모두 해결
 */
function processPrivateKey(privateKey: string): string {
  if (!privateKey) {
    throw new Error('Private key is empty or undefined');
  }

  // Private key processing started (security: no content logged)
  
  let processedKey = privateKey;
  
  // 1. 다양한 newline 인코딩 처리
  processedKey = processedKey.replace(/\\\\n/g, '\n'); // \\n → \n
  processedKey = processedKey.replace(/\\n/g, '\n');     // \n → actual newline
  
  // 2. 불필요한 공백 제거
  processedKey = processedKey.trim();
  
  // 3. PEM 헤더/푸터 정의
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  
  // 4. 🔧 CRITICAL: 한 줄 PEM 형식 처리 (헤더와 푸터 사이의 Base64 데이터 추출)
  let base64Data = '';
  
  if (processedKey.includes(pemHeader) && processedKey.includes(pemFooter)) {
    // PEM 헤더와 푸터 사이의 내용을 정확히 추출
    const headerIndex = processedKey.indexOf(pemHeader);
    const footerIndex = processedKey.indexOf(pemFooter);
    
    if (headerIndex !== -1 && footerIndex !== -1 && footerIndex > headerIndex) {
      // 헤더 다음부터 푸터 이전까지의 내용 추출
      const startIndex = headerIndex + pemHeader.length;
      const endIndex = footerIndex;
      const middleContent = processedKey.substring(startIndex, endIndex);
      
      // Processing PEM content between headers (security: no content logged)
      
      // 모든 공백, 줄바꿈, 특수문자 제거하고 Base64 데이터만 추출
      base64Data = middleContent
        .replace(/\s/g, '')           // 모든 공백 제거
        .replace(/\n/g, '')           // 줄바꿈 제거
        .replace(/\r/g, '')           // 캐리지 리턴 제거
        .replace(/\t/g, '')           // 탭 제거
        .replace(/[^A-Za-z0-9+/=]/g, ''); // Base64가 아닌 문자 제거
      
      // Base64 data processed successfully (security: no content logged)
    }
  }
  
  // 5. Base64 데이터가 없으면 전체 내용에서 추출 시도
  if (base64Data.length === 0) {
    // Fallback: attempting full content Base64 extraction
    
    // 헤더와 푸터 제거 후 Base64 데이터 추출
    base64Data = processedKey
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '')
      .replace(/[^A-Za-z0-9+/=]/g, '');
    
    // Base64 extraction completed (security: no content logged)
  }
  
  // 6. Base64 데이터 유효성 검증
  if (base64Data.length === 0) {
    console.error('❌ [GCS] CRITICAL: Base64 content is empty after all extraction attempts!');
    console.error('🔧 [GCS] 원본 키 분석:');
    console.error('   - 원본 길이:', privateKey.length);
    console.error('   - 헤더 포함:', privateKey.includes(pemHeader));
    console.error('   - 푸터 포함:', privateKey.includes(pemFooter));
    console.error('🔧 [GCS] 해결방법:');
    console.error('   1. Google Cloud Console에서 새 서비스 계정 키 생성');
    console.error('   2. JSON 파일 다운로드 후 GOOGLE_APPLICATION_CREDENTIALS_JSON 환경변수 설정');
    console.error('   3. Replit Secrets에서 올바른 형식의 private key 설정');
    throw new Error('❌ Private key contains no Base64 content - credentials are corrupted');
  }
  
  // 7. Base64 데이터 길이 검증 (RSA 2048 키는 대략 2600자 정도)
  if (base64Data.length < 1000) {
    console.warn('⚠️ [GCS] Base64 데이터가 예상보다 짧습니다:', base64Data.length);
  }
  
  // 8. PEM 형식으로 재구성 (64자마다 줄바꿈)
  const formattedBase64 = base64Data.match(/.{1,64}/g)?.join('\n') || base64Data;
  processedKey = `${pemHeader}\n${formattedBase64}\n${pemFooter}`;
  
  // Private key processing completed successfully (security: no content logged)
  
  return processedKey;
}

/**
 * 🔧 GCS Storage 초기화 - 메타데이터 서비스 완전 차단
 * Replit 환경 전용: ADC 및 메타데이터 서비스 의존성 완전 제거
 */
function initializeGCSStorage(): Storage {
  console.log('🔄 [GCS] Storage 초기화 시작... (메타데이터 서비스 완전 차단)');
  
  // 🚫 CRITICAL: ADC 및 메타데이터 서비스 완전 차단을 위한 환경변수 설정
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '';  // ADC 경로 차단
  process.env.GCLOUD_PROJECT = '';                   // gcloud SDK 프로젝트 차단
  process.env.GOOGLE_CLOUD_PROJECT = '';             // GCP 프로젝트 자동 감지 차단
  process.env.GCE_METADATA_HOST = '';                // 메타데이터 호스트 차단 (핵심!)
  process.env.GCE_METADATA_IP = '';                  // 메타데이터 IP 차단
  process.env.METADATA_SERVER_DETECTION = 'false';  // 메타데이터 서버 감지 완전 비활성화
  
  console.log('🚫 [GCS] ADC 및 메타데이터 서비스 접근 완전 차단');
  
  // 🔧 REPLIT 환경 우선순위 변경: 개별 환경변수를 1순위로 (JSON 파싱 이슈 회피)
  console.log('🔄 [GCS] Replit 환경 최적화: 개별 환경변수 우선 사용');
  
  // 1순위: 개별 환경변수 - FORCED (ADC 차단) - REPLIT 최적화
  if (process.env.GOOGLE_CLOUD_PRIVATE_KEY && process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_CLIENT_EMAIL) {
    try {
      console.log('🔄 [GCS] 개별 환경변수로 Storage 구성 (강제 모드)...');
      
      const processedPrivateKey = processPrivateKey(process.env.GOOGLE_CLOUD_PRIVATE_KEY);
      
      // 🔒 CRITICAL: 메타데이터 서비스 완전 차단 설정
      const storage = new Storage({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        credentials: {
          client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
          private_key: processedPrivateKey,
          type: 'service_account'  // 명시적 서비스 계정 타입
        },
        // 키 파일 기반 인증 강제
        keyFilename: undefined,  // 키 파일 경로 차단
        // 명시적 스코프 설정
        scopes: [
          'https://www.googleapis.com/auth/devstorage.full_control',
          'https://www.googleapis.com/auth/cloud-platform'
        ]
      });
      
      console.log('✅ [GCS] 개별 환경변수로 초기화 성공 (메타데이터 서비스 차단)');
      return storage;
    } catch (error) {
      console.error('❌ [GCS] 개별 환경변수 처리 실패:', error);
      // 개별 환경변수가 실패하면 JSON 시도하지 않고 바로 에러
      throw new Error(`GCS 개별 변수 초기화 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // 2순위: GOOGLE_APPLICATION_CREDENTIALS_JSON (통합 JSON) - FALLBACK
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    try {
      console.log('🔄 [GCS] GOOGLE_APPLICATION_CREDENTIALS_JSON 사용 (강제 모드)...');
      
      // 🔧 CRITICAL: JSON 파싱 전 escape character 문제 해결
      let jsonString = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
      console.log('🔍 [GCS] 원본 JSON 길이:', jsonString.length);
      console.log('🔍 [GCS] 위치 151 주변:', jsonString.substring(140, 160));
      
      // 🔧 CRITICAL: JSON escape character 문제 해결 (특히 position 151 문제)
      jsonString = jsonString
        // 1. 가장 큰 문제: 백슬래시 뒤에 실제 개행문자가 있는 경우
        .replace(/\\\n/g, '\\n')     // \<actual newline> → \n (핵심 수정!)
        .replace(/\\\r\n/g, '\\n')   // \<actual CRLF> → \n
        .replace(/\\\r/g, '\\n')     // \<actual CR> → \n
        // 2. 일반적인 double escape 문제
        .replace(/\\\\n/g, '\\n')    // \\n → \n (double backslash fix)
        .replace(/\\\\\\/g, '\\\\')  // \\\\ → \\ (backslash fix)
        .replace(/\\\\"/g, '\\"')    // \\" → \" (quote fix)
        .replace(/\\\\\t/g, '\\t')   // \\t → \t (tab fix)
        .replace(/\\\\\r/g, '\\r');  // \\r → \r (carriage return fix)
      
      console.log('🔧 [GCS] JSON escape character 수정 완료');
      
      const credentials = JSON.parse(jsonString);
      console.log('✅ [GCS] JSON 파싱 성공');
      
      // Private key 처리
      if (credentials.private_key) {
        credentials.private_key = processPrivateKey(credentials.private_key);
      }
      
      // 🔒 CRITICAL: 메타데이터 서비스 완전 차단 설정
      const storage = new Storage({
        projectId: credentials.project_id,
        credentials: credentials,
        // 키 파일 기반 인증 강제
        keyFilename: undefined,  // 키 파일 경로 차단
        // 명시적 스코프 설정
        scopes: [
          'https://www.googleapis.com/auth/devstorage.full_control',
          'https://www.googleapis.com/auth/cloud-platform'
        ]
      });
      
      console.log('✅ [GCS] JSON credentials로 초기화 성공 (메타데이터 서비스 차단)');
      return storage;
    } catch (error) {
      console.error('❌ [GCS] JSON credentials 처리 실패:', error);
      throw new Error(`GCS JSON 초기화 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // 2순위: 개별 환경변수 - FORCED (ADC 차단)
  if (process.env.GOOGLE_CLOUD_PRIVATE_KEY && process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_CLIENT_EMAIL) {
    try {
      console.log('🔄 [GCS] 개별 환경변수로 Storage 구성 (강제 모드)...');
      
      const processedPrivateKey = processPrivateKey(process.env.GOOGLE_CLOUD_PRIVATE_KEY);
      
      // 🔒 CRITICAL: 메타데이터 서비스 완전 차단 설정
      const storage = new Storage({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        credentials: {
          client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
          private_key: processedPrivateKey,
          type: 'service_account'  // 명시적 서비스 계정 타입
        },
        // 키 파일 기반 인증 강제
        keyFilename: undefined,  // 키 파일 경로 차단
        // 명시적 스코프 설정
        scopes: [
          'https://www.googleapis.com/auth/devstorage.full_control',
          'https://www.googleapis.com/auth/cloud-platform'
        ]
      });
      
      console.log('✅ [GCS] 개별 환경변수로 초기화 성공 (메타데이터 서비스 차단)');
      return storage;
    } catch (error) {
      console.error('❌ [GCS] 개별 환경변수 처리 실패:', error);
      throw new Error(`GCS 개별 변수 초기화 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // 🚫 ADC 완전 제거: Replit 환경에서는 절대 사용하지 않음
  console.error('❌ [GCS] CRITICAL: 모든 명시적 인증 방식 실패');
  console.error('🔧 [GCS] 해결방법:');
  console.error('   1. GOOGLE_APPLICATION_CREDENTIALS_JSON 환경변수 설정 (권장)');
  console.error('   2. 개별 환경변수 설정 (GOOGLE_CLOUD_PRIVATE_KEY, GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_CLIENT_EMAIL)');
  console.error('   3. Google Cloud Console에서 새 서비스 계정 키 다운로드');
  throw new Error('🚫 GCS 초기화 실패: 명시적 인증 정보 없음 (ADC 차단됨)');
}

// GCS Storage 인스턴스 초기화
const storage = initializeGCSStorage();

// 🔧 환경변수 통합: 일관된 버킷 참조 사용
// DECODER 에러 해결을 위해 환경변수 확실히 설정
if (!process.env.GOOGLE_CLOUD_STORAGE_BUCKET) {
  console.log('⚠️ [GCS] GOOGLE_CLOUD_STORAGE_BUCKET 환경변수 누락, 기본값 사용');
  process.env.GOOGLE_CLOUD_STORAGE_BUCKET = 'createtree-upload';
}

const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || process.env.GCS_BUCKET_NAME || 'createtree-upload';
const bucket = storage.bucket(bucketName);

console.log('📦 [GCS] 사용 중인 버킷:', bucketName);
console.log('✅ [GCS] DECODER 에러 방지를 위한 환경변수 설정 완료');

// 🔄 검증된 GCS 인스턴스들을 다른 모듈에서 재사용할 수 있도록 export
export { storage, bucket, bucketName };

interface GCSImageResult {
  originalUrl: string;
  thumbnailUrl: string;
  gsPath: string;
  gsThumbnailPath: string;
  fileName: string;
  thumbnailFileName: string;
}

/**
 * 사용자 ID를 해시 기반 경로로 변환 (확장성을 위한 폴더 구조)
 * 예: userId "24" → "0/0/0/24", userId "1234" → "1/2/3/1234"
 */
function generateHashPath(userId: string | number): string {
  const userIdString = String(userId); // 안전하게 문자열로 변환
  const hash = userIdString.padStart(6, '0'); // 최소 6자리로 패딩
  return `${hash[0]}/${hash[1]}/${hash[2]}`;
}

/**
 * GCS에 이미지와 썸네일을 저장하고 공개 URL을 반환
 * @param imageBuffer 이미지 버퍼
 * @param userId 사용자 ID
 * @param category 카테고리 (기본값: 'general')
 * @param originalFileName 원본 파일명 (선택사항)
 * @returns GCS 경로와 공개 URL 정보
 */
export async function saveImageToGCS(
  imageBuffer: Buffer,
  userId: string | number,
  category: string = 'general',
  originalFileName?: string
): Promise<GCSImageResult> {
  try {
    // 이미지 버퍼 유효성 검증
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('유효하지 않은 이미지 버퍼입니다');
    }

    console.log('GCS 이미지 저장 시작:', {
      bufferSize: imageBuffer.length,
      userId,
      category,
      originalFileName
    });

    const timestamp = Date.now();
    const fileExtension = '.webp'; // 최적화를 위해 WebP 사용
    const fileName = originalFileName 
      ? `${timestamp}_${path.parse(originalFileName).name}${fileExtension}`
      : `${timestamp}_generated_image${fileExtension}`;
    
    // 확장 가능한 해시 기반 GCS 경로 구성
    const hashPath = generateHashPath(userId);
    const originalPath = `images/${category}/${hashPath}/${userId}/${fileName}`;
    const thumbnailPath = `images/${category}/${hashPath}/${userId}/thumbnails/${fileName}`;
    
    console.log(`📁 확장 경로 생성: ${originalPath}`);
    
    // Sharp 인스턴스 유효성 검증
    let sharpInstance;
    try {
      sharpInstance = sharp(imageBuffer);
      await sharpInstance.metadata(); // 이미지 유효성 검증
    } catch (error) {
      console.error('Sharp 이미지 처리 오류:', error);
      throw new Error('이미지 형식이 지원되지 않습니다');
    }
    
    // 원본 이미지 최적화 (WebP로 변환, 최대 2048px)
    const optimizedOriginal = await sharp(imageBuffer)
      .webp({ quality: 90 })
      .resize(2048, 2048, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .toBuffer();
    
    // 썸네일 생성 (300x300)
    const thumbnailBuffer = await sharp(imageBuffer)
      .webp({ quality: 80 })
      .resize(300, 300, { 
        fit: 'cover' 
      })
      .toBuffer();
    
    // 원본 이미지 업로드
    const originalFile = bucket.file(originalPath);
    await originalFile.save(optimizedOriginal, {
      metadata: {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000', // 일반 웹사이트 캐시 정책
        metadata: {
          category,
          userId,
          originalFileName: originalFileName || 'generated',
          createdAt: new Date().toISOString(),
        },
      },
    });
    
    // 사용자 생성 이미지 저장 완료
    await originalFile.makePublic(); // 공개 접근 허용
    console.log(`✅ 원본 이미지 저장 완료: ${originalPath}`);
    
    // 썸네일 업로드
    const thumbnailFile = bucket.file(thumbnailPath);
    await thumbnailFile.save(thumbnailBuffer, {
      metadata: {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000', // 일반 웹사이트 캐시 정책
        metadata: {
          category,
          userId,
          imageType: 'thumbnail',
          createdAt: new Date().toISOString(),
        },
      },
    });
    
    // 썸네일 이미지 저장 완료
    await thumbnailFile.makePublic(); // 공개 접근 허용
    console.log(`✅ 썸네일 저장 완료: ${thumbnailPath}`);
    
    // Signed URL 생성 (의료 환경 보안 강화 - 시간 제한된 인증 접근)
    const ttlMinutes = parseInt(process.env.SIGNED_URL_TTL_MINUTES || '30'); // 기본 30분
    const expirationTime = Date.now() + (ttlMinutes * 60 * 1000);
    
    const [originalUrl] = await originalFile.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expirationTime, // 🔒 HIPAA: 단축된 TTL
    });
    
    const [thumbnailUrl] = await thumbnailFile.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expirationTime, // 🔒 HIPAA: 단축된 TTL
    });
    
    console.log(`🔒 GCS Signed URL 생성 완료: ${originalPath}`);
    console.log(`✅ 의료 환경 보안 강화: PRIVATE 모드 이미지 저장 완료`);
    console.log(`🔐 인증된 접근만 허용 - ${ttlMinutes}분 후 자동 만료 (HIPAA 준수)`);
    
    const bucketName = bucket.name;
    return {
      originalUrl,
      thumbnailUrl,
      gsPath: `gs://${bucketName}/${originalPath}`,
      gsThumbnailPath: `gs://${bucketName}/${thumbnailPath}`,
      fileName,
      thumbnailFileName: fileName,
    };
    
  } catch (error) {
    console.error('❌ GCS 이미지 저장 실패:', error);
    throw new Error(`GCS 이미지 저장 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Base64 이미지를 GCS에 저장
 * @param base64Data Base64 인코딩된 이미지 데이터
 * @param userId 사용자 ID
 * @param category 카테고리
 * @param originalFileName 원본 파일명
 * @returns GCS 저장 결과
 */
export async function saveBase64ImageToGCS(
  base64Data: string,
  userId: string | number,
  category: string = 'general',
  originalFileName?: string
): Promise<GCSImageResult> {
  // Base64에서 Buffer로 변환
  const base64String = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
  const imageBuffer = Buffer.from(base64String, 'base64');
  
  return saveImageToGCS(imageBuffer, userId, category, originalFileName);
}

/**
 * URL에서 이미지를 다운로드하여 GCS에 저장
 * @param imageUrl 이미지 URL
 * @param userId 사용자 ID
 * @param category 카테고리
 * @param originalFileName 원본 파일명
 * @returns GCS 저장 결과
 */
export async function saveImageFromUrlToGCS(
  imageUrl: string,
  userId: string | number,
  category: string = 'general',
  originalFileName?: string
): Promise<GCSImageResult> {
  try {
    console.log(`📥 이미지 다운로드 시작: ${imageUrl}`);
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`이미지 다운로드 실패: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    
    console.log(`📦 이미지 다운로드 완료: ${(imageBuffer.length / 1024).toFixed(2)}KB`);
    
    return saveImageToGCS(imageBuffer, userId, category, originalFileName);
    
  } catch (error) {
    console.error('❌ URL 이미지 저장 실패:', error);
    throw new Error(`URL 이미지 저장 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * GCS 경로를 공개 URL로 변환
 * @param gsPath GS 경로 (gs://bucket/path/to/file)
 * @returns 공개 접근 가능한 HTTP URL
 */
export function generatePublicUrl(gsPath: string): string {
  if (!gsPath || !gsPath.startsWith('gs://')) {
    throw new Error('잘못된 GS 경로 형식입니다. gs://bucket/path 형식이어야 합니다.');
  }
  
  // gs://bucket/path/to/file -> https://storage.googleapis.com/bucket/path/to/file
  const publicUrl = gsPath.replace('gs://', 'https://storage.googleapis.com/');
  console.log(`🌐 PUBLIC URL 생성: ${gsPath} -> ${publicUrl}`);
  return publicUrl;
}

/**
 * Signed URL을 공개 URL로 변환 (배너 이미지 등 공개 콘텐츠 전용)
 * @param signedUrl 기존 Signed URL
 * @returns 공개 URL
 */
export function convertToPublicUrl(signedUrl: string): string {
  try {
    // Signed URL에서 GS 경로 추출
    const url = new URL(signedUrl);
    const pathname = url.pathname;
    
    // /bucket/path/to/file -> https://storage.googleapis.com/bucket/path/to/file
    const publicUrl = `https://storage.googleapis.com${pathname}`;
    console.log(`🔄 Signed URL -> Public URL 변환: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.warn('⚠️ URL 변환 실패, 원본 URL 반환:', signedUrl);
    return signedUrl;
  }
}

/**
 * 모든 이미지를 공개 접근 가능하게 설정 (공개 콘텐츠 전용)
 * 주의: 개인정보가 포함된 이미지에는 사용하지 마세요
 */
export async function setAllImagesPublic(): Promise<void> {
  try {
    console.log('🌐 모든 이미지 공개 설정 시작...');
    
    const [files] = await bucket.getFiles();
    let publicCount = 0;
    
    for (const file of files) {
      try {
        await file.makePublic();
        publicCount++;
      } catch (error) {
        console.warn(`⚠️ 파일 공개 설정 실패: ${file.name}`, error);
      }
    }
    
    console.log(`✅ ${publicCount}/${files.length}개 이미지 공개 설정 완료`);
  } catch (error) {
    console.error('❌ 이미지 공개 설정 실패:', error);
    throw new Error(`이미지 공개 설정 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 🌐 배너 전용 PUBLIC 이미지 저장 함수
 * 
 * ⚠️ 중요: 이 함수는 배너 및 공개 콘텐츠 전용입니다
 * 의료 데이터나 개인정보가 포함된 이미지에는 절대 사용하지 마세요!
 * 
 * @param imageBuffer 이미지 버퍼
 * @param bannerType 배너 타입 ('slide' | 'small')
 * @param originalFileName 원본 파일명 (선택사항)
 * @returns 영구 PUBLIC URL과 GCS 경로 정보
 */
export async function saveBannerToGCS(
  imageBuffer: Buffer,
  bannerType: 'slide' | 'small',
  originalFileName?: string
): Promise<{
  publicUrl: string;
  gsPath: string;
  fileName: string;
}> {
  try {
    // 이미지 버퍼 유효성 검증
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('유효하지 않은 이미지 버퍼입니다');
    }

    console.log('🌐 PUBLIC 배너 이미지 저장 시작:', {
      bufferSize: imageBuffer.length,
      bannerType,
      originalFileName
    });

    const timestamp = Date.now();
    const fileExtension = '.webp'; // 최적화를 위해 WebP 사용
    const fileName = originalFileName 
      ? `${timestamp}_${path.parse(originalFileName).name}${fileExtension}`
      : `banner_${timestamp}${fileExtension}`;
    
    // 배너 전용 GCS 경로 구성 (의료 데이터와 완전 분리)
    const bannerPath = `banners/${bannerType}/${fileName}`;
    
    console.log(`📁 배너 PUBLIC 경로 생성: ${bannerPath}`);
    
    // Sharp 인스턴스 유효성 검증
    let sharpInstance;
    try {
      sharpInstance = sharp(imageBuffer);
      await sharpInstance.metadata(); // 이미지 유효성 검증
    } catch (error) {
      console.error('Sharp 이미지 처리 오류:', error);
      throw new Error('이미지 형식이 지원되지 않습니다');
    }
    
    // 배너 이미지 최적화 (WebP로 변환, 적절한 크기)
    const maxWidth = bannerType === 'slide' ? 1920 : 800; // 슬라이드는 크게, 작은 배너는 작게
    const maxHeight = bannerType === 'slide' ? 1080 : 600;
    
    const optimizedBanner = await sharp(imageBuffer)
      .webp({ quality: 95 }) // 배너는 고품질로
      .resize(maxWidth, maxHeight, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .toBuffer();
    
    // 배너 이미지 업로드 (PUBLIC 모드)
    const bannerFile = bucket.file(bannerPath);
    await bannerFile.save(optimizedBanner, {
      metadata: {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000', // 🌐 PUBLIC: 1년 캐시 허용
        metadata: {
          type: 'banner',
          bannerType,
          originalFileName: originalFileName || 'uploaded',
          createdAt: new Date().toISOString(),
          isPublic: 'true', // 명시적으로 공개 콘텐츠임을 표시
        },
      },
    });
    
    // 🌐 CRITICAL: 배너를 PUBLIC으로 설정 (의료 데이터가 아니므로 안전)
    await bannerFile.makePublic();
    console.log(`🌐 배너 이미지 PUBLIC 모드 저장 완료: ${bannerPath}`);
    
    // 영구 PUBLIC URL 생성
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${bannerPath}`;
    
    console.log(`🌐 배너 PUBLIC URL 생성 완료: ${publicUrl}`);
    console.log(`✅ 배너 PUBLIC 저장 완료 - 영구 URL 제공`);
    
    return {
      publicUrl,
      gsPath: `gs://${bucketName}/${bannerPath}`,
      fileName,
    };
    
  } catch (error) {
    console.error('❌ 배너 GCS 저장 실패:', error);
    throw new Error(`배너 GCS 저장 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 🌐 Base64 배너 이미지를 GCS에 PUBLIC으로 저장
 * @param base64Data Base64 인코딩된 이미지 데이터
 * @param bannerType 배너 타입 ('slide' | 'small')
 * @param originalFileName 원본 파일명
 * @returns 배너 PUBLIC 저장 결과
 */
export async function saveBase64BannerToGCS(
  base64Data: string,
  bannerType: 'slide' | 'small',
  originalFileName?: string
): Promise<{
  publicUrl: string;
  gsPath: string;
  fileName: string;
}> {
  // Base64에서 Buffer로 변환
  const base64String = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
  const imageBuffer = Buffer.from(base64String, 'base64');
  
  return saveBannerToGCS(imageBuffer, bannerType, originalFileName);
}

/**
 * 🔄 기존 PRIVATE 배너를 PUBLIC으로 변환
 * @param gsPath 기존 GS 경로 (gs://bucket/path/to/file)
 * @param bannerType 배너 타입 ('slide' | 'small')
 * @returns 새로운 PUBLIC URL
 */
export async function convertBannerToPublic(
  gsPath: string,
  bannerType: 'slide' | 'small'
): Promise<{
  publicUrl: string;
  newGsPath: string;
  fileName: string;
}> {
  try {
    console.log(`🔄 배너 PRIVATE→PUBLIC 변환 시작: ${gsPath}`);
    
    // GS 경로에서 파일 경로 추출
    const matches = gsPath.match(/^gs:\/\/([^\/]+)\/(.+)$/);
    if (!matches) {
      throw new Error('유효하지 않은 GS 경로입니다');
    }
    
    const [, sourceBucket, sourceFilePath] = matches;
    const sourceFile = storage.bucket(sourceBucket).file(sourceFilePath);
    
    // 기존 파일 존재 여부 확인
    const [exists] = await sourceFile.exists();
    if (!exists) {
      throw new Error('원본 파일이 존재하지 않습니다');
    }
    
    // 기존 파일 다운로드
    const [fileBuffer] = await sourceFile.download();
    console.log(`📥 기존 파일 다운로드 완료: ${(fileBuffer.length / 1024).toFixed(2)}KB`);
    
    // 새로운 배너 파일명 생성
    const originalFileName = path.basename(sourceFilePath);
    
    // PUBLIC 배너로 재업로드
    const result = await saveBannerToGCS(fileBuffer, bannerType, originalFileName);
    
    console.log(`🔄 배너 PRIVATE→PUBLIC 변환 완료`);
    console.log(`   원본: ${gsPath}`);
    console.log(`   신규: ${result.publicUrl}`);
    
    return {
      publicUrl: result.publicUrl,
      newGsPath: result.gsPath,
      fileName: result.fileName,
    };
    
  } catch (error) {
    console.error('❌ 배너 PUBLIC 변환 실패:', error);
    throw new Error(`배너 PUBLIC 변환 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}