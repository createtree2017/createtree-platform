import { Storage } from '@google-cloud/storage';
import https from 'https';
import http from 'http';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// .env 파일 로딩
dotenv.config();

// GCS 설정 확인
function isGcsConfigured(): boolean {
  return !!(process.env.GOOGLE_CLOUD_PROJECT_ID && 
           process.env.GOOGLE_CLOUD_CLIENT_EMAIL && 
           process.env.GOOGLE_CLOUD_PRIVATE_KEY);
}

// GCS Storage 클라이언트 - 환경변수 기반 인증 방식 복구
let storage: Storage | null = null;

if (isGcsConfigured()) {
  storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n')
    }
  });
  console.log('✅ GCS 클라이언트 초기화 완료');
} else {
  console.log('⚠️ GCS 인증 정보 누락 - 로컬 파일 시스템 사용');
}

/**
 * 로컬 파일 시스템에 저장하는 함수
 * @param buffer - 저장할 Buffer 데이터
 * @param targetPath - 저장 경로 (예: 'collages/collage_123.png')
 * @returns Promise<string> - 로컬 파일 URL
 */
async function saveToLocalStorage(buffer: Buffer, targetPath: string): Promise<string> {
  const localDir = path.join(process.cwd(), 'public', 'uploads');
  const fullPath = path.join(localDir, targetPath);
  
  // 디렉토리 생성
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 [Local] 디렉토리 생성: ${dir}`);
  }
  
  // 파일 저장
  fs.writeFileSync(fullPath, buffer);
  console.log(`💾 [Local] 파일 저장 완료: ${fullPath} (${buffer.length} bytes)`);
  
  // 정적 파일 URL 반환
  const localUrl = `/uploads/${targetPath}`;
  console.log(`🔗 [Local] 접근 URL: ${localUrl}`);
  return localUrl;
}

/**
 * GCS 버킷 존재 확인 및 생성
 */
async function ensureBucketExists(bucketName: string): Promise<void> {
  const bucket = storage.bucket(bucketName);
  
  try {
    const [exists] = await bucket.exists();
    
    if (!exists) {
      console.log(`🔧 GCS 버킷 ${bucketName} 생성 중...`);
      await bucket.create({
        location: 'ASIA-NORTHEAST3', // 서울 리전
        storageClass: 'STANDARD'
      });
      
      // 기본 버킷 생성 (공개 권한은 필요시 별도 설정)
      // await bucket.makePublic(); // 필요시 공개 권한 활성화
      console.log(`✅ GCS 버킷 ${bucketName} 생성 완료`);
    }
  } catch (error) {
    console.log(`⚠️ 버킷 확인/생성 중 오류:`, error);
  }
}

/**
 * GCS 업로드 모듈 - 작업지시서 기준
 */
export async function uploadToGCS(remoteUrl: string, targetPath: string): Promise<string> {
  const bucketName = 'createtree-upload';
  console.log(`🔄 [GCS] 업로드 시작: ${remoteUrl} → ${targetPath}`);
  
  // 버킷 존재 확인 및 생성
  await ensureBucketExists(bucketName);
  
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(targetPath);
  
  return new Promise((resolve, reject) => {
    const client = remoteUrl.startsWith('https:') ? https : http;
    let downloadSize = 0;
    const chunks: Buffer[] = [];
    
    client.get(remoteUrl, (response) => {
      if (!response.statusCode || response.statusCode !== 200) {
        console.log(`❌ [GCS] HTTP 오류: ${response.statusCode}`);
        reject(new Error(`Failed to fetch: ${response.statusCode}`));
        return;
      }
      
      const contentLength = response.headers['content-length'];
      console.log(`📊 [GCS] 예상 크기: ${contentLength} bytes`);
      
      // 데이터 수집 후 크기 검증
      response.on('data', (chunk) => {
        chunks.push(chunk);
        downloadSize += chunk.length;
      });
      
      response.on('end', async () => {
        console.log(`📥 [GCS] 다운로드 완료: ${downloadSize} bytes`);
        
        if (downloadSize < 1000) {
          console.log(`❌ [GCS] 파일이 너무 작음: ${downloadSize} bytes`);
          reject(new Error(`File too small: ${downloadSize} bytes`));
          return;
        }
        
        try {
          // 전체 버퍼 생성
          const buffer = Buffer.concat(chunks);
          
          const writeStream = file.createWriteStream({
            metadata: {
              contentType: 'audio/mpeg',
              metadata: {
                originalUrl: remoteUrl,
                uploadedAt: new Date().toISOString(),
                fileSize: downloadSize.toString()
              }
            }
          });
          
          writeStream.on('error', (error) => {
            console.log(`❌ [GCS] 업로드 오류:`, error);
            reject(error);
          });
          
          writeStream.on('finish', async () => {
            console.log(`✅ [GCS] 업로드 완료: ${downloadSize} bytes`);
            
            // 공개 접근 권한 설정 (필요시 활성화)
            try {
              await file.makePublic(); // 공개 콘텐츠로 사용시 활성화
              console.log(`🌐 [GCS] 공개 접근 권한 설정 완료`);
            } catch (permError) {
              console.log(`⚠️ [GCS] 권한 설정 오류:`, permError);
            }
            console.log(`✅ [GCS] 이미지 저장 완료`);
            
            const gcsUrl = `https://storage.googleapis.com/${bucketName}/${targetPath}`;
            resolve(gcsUrl);
          });
          
          // 버퍼 데이터 전송
          writeStream.end(buffer);
          
        } catch (uploadError) {
          console.log(`❌ [GCS] 버퍼 처리 오류:`, uploadError);
          reject(uploadError);
        }
      });
      
    }).on('error', (downloadError) => {
      console.log(`❌ [GCS] 다운로드 오류:`, downloadError);
      reject(downloadError);
    });
  });
}

/**
 * Buffer를 GCS에 직접 업로드하는 함수 (기존 이미지 업로드와 동일한 방식)
 * @param buffer - 업로드할 Buffer 데이터
 * @param targetPath - GCS 내 저장 경로 (예: 'collages/collage_123.png')
 * @param contentType - 파일의 MIME 타입 (예: 'image/png')
 * @returns Promise<string> - 업로드된 파일의 공개 URL (또는 로컬 경로)
 */
export async function uploadBufferToGCS(buffer: Buffer, targetPath: string, contentType: string = 'image/png'): Promise<string> {
  // GCS가 설정되지 않은 경우 로컬 저장소 사용
  if (!storage || !isGcsConfigured()) {
    console.log(`⚠️ [Storage] GCS 미설정 - 로컬 저장소 사용: ${targetPath}`);
    return await saveToLocalStorage(buffer, targetPath);
  }
  
  const bucketName = 'createtree-upload';
  console.log(`🔄 [GCS] Buffer 업로드 시작: ${targetPath} (${buffer.length} bytes)`);
  
  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(targetPath);
    
    // file.save() 메서드 사용 (gcs-image-storage.ts와 동일)
    await file.save(buffer, {
      metadata: {
        contentType,
        cacheControl: 'public, max-age=31536000', // 1년 캐시
        metadata: {
          uploadedAt: new Date().toISOString(),
          fileSize: buffer.length.toString()
        }
      }
    });
    
    console.log(`✅ [GCS] 업로드 완료: ${buffer.length} bytes`);
    
    // 공개 접근 권한 설정 (필요시 활성화)
    try {
      await file.makePublic(); // 공개 콘텐츠로 사용시 활성화
      console.log(`🌐 [GCS] 공개 접근 권한 설정 완료`);
    } catch (permError: any) {
      console.log(`⚠️ [GCS] 권한 설정 스킵:`, permError.message);
    }
    console.log(`✅ [GCS] 이미지 저장 완료`);
    
    const gcsUrl = `https://storage.googleapis.com/${bucketName}/${targetPath}`;
    console.log(`📎 [GCS] 공개 URL: ${gcsUrl}`);
    return gcsUrl;
    
  } catch (error) {
    console.error(`❌ [GCS] 업로드 실패, 로컬 저장소로 폴백:`, error);
    return await saveToLocalStorage(buffer, targetPath);
  }
}

/**
 * GCS Signed URL에서 파일 경로 추출
 * @param signedUrl GCS signed URL
 * @returns 파일 경로 (예: "uploads/24/filename.jpg") 또는 null
 */
export function extractGCSFilePath(signedUrl: string): string | null {
  try {
    const url = new URL(signedUrl);
    // https://storage.googleapis.com/bucket-name/path/to/file.jpg?signed_params...
    const pathParts = url.pathname.split('/');
    if (pathParts.length >= 3) {
      // Remove empty string and bucket name, keep the rest
      return pathParts.slice(2).join('/');
    }
    return null;
  } catch (error) {
    console.warn('🔍 [extractGCSFilePath] URL 파싱 실패:', error);
    return null;
  }
}

/**
 * GCS signed URL이 만료되었는지 확인
 * @param signedUrl GCS signed URL
 * @returns true if expired, false if valid
 */
export function isSignedUrlExpired(signedUrl: string): boolean {
  try {
    const url = new URL(signedUrl);
    const params = new URLSearchParams(url.search);
    
    // X-Goog-Date와 X-Goog-Expires 파라미터 확인
    const googleDate = params.get('X-Goog-Date');
    const expires = params.get('X-Goog-Expires');
    
    if (!googleDate || !expires) {
      // signed URL이 아니면 만료되지 않음
      return false;
    }
    
    // X-Goog-Date 형식: YYYYMMDDTHHMMSSZ
    const year = parseInt(googleDate.substring(0, 4));
    const month = parseInt(googleDate.substring(4, 6)) - 1; // 0-based
    const day = parseInt(googleDate.substring(6, 8));
    const hour = parseInt(googleDate.substring(9, 11));
    const minute = parseInt(googleDate.substring(11, 13));
    const second = parseInt(googleDate.substring(13, 15));
    
    const issueTime = new Date(year, month, day, hour, minute, second).getTime();
    const expirationSeconds = parseInt(expires);
    const expirationTime = issueTime + (expirationSeconds * 1000);
    
    const now = Date.now();
    const isExpired = now > expirationTime;
    
    if (isExpired) {
      console.log(`⏰ [isSignedUrlExpired] URL 만료됨: 발급시간=${new Date(issueTime).toISOString()}, 만료시간=${new Date(expirationTime).toISOString()}, 현재시간=${new Date(now).toISOString()}`);
    }
    
    return isExpired;
  } catch (error) {
    console.warn('🔍 [isSignedUrlExpired] URL 파싱 실패:', error);
    return false;
  }
}

/**
 * GCS 파일 경로를 공개 URL로 변환
 * @param filePath GCS 파일 경로 (예: "uploads/24/filename.jpg")
 * @returns 공개 URL
 */
export function convertToPublicUrl(filePath: string): string {
  const bucketName = 'createtree-upload';
  return `https://storage.googleapis.com/${bucketName}/${filePath}`;
}

/**
 * URL 해결 함수 - 만료된 signed URL을 공개 URL로 변환
 * @param url 원본 URL (signed 또는 public)
 * @returns 해결된 URL
 */
export function resolveImageUrl(url: string): string {
  // null/undefined 체크
  if (!url || url.trim() === '') {
    return '';
  }
  
  // 이미 공개 URL이고 signed 파라미터가 없는 경우 그대로 반환
  if (url.startsWith('https://storage.googleapis.com/') && !url.includes('X-Goog-Algorithm')) {
    return url;
  }
  
  // signed URL 만료 확인
  if (url.includes('X-Goog-Algorithm') && isSignedUrlExpired(url)) {
    console.log(`🔄 [resolveImageUrl] 만료된 signed URL 감지, 공개 URL로 변환: ${url}`);
    
    const filePath = extractGCSFilePath(url);
    if (filePath) {
      const publicUrl = convertToPublicUrl(filePath);
      console.log(`✅ [resolveImageUrl] 공개 URL 생성: ${publicUrl}`);
      return publicUrl;
    }
  }
  
  // 그외 경우 원본 URL 반환
  return url;
}

/**
 * GCS URL에서 파일 경로 추출
 * @param url - GCS URL (예: 'https://storage.googleapis.com/createtree-upload/images/...')
 * @returns 파일 경로 또는 null
 */
export function extractGCSPathFromUrl(url: string): string | null {
  try {
    const bucketName = 'createtree-upload';
    
    // https://storage.googleapis.com/createtree-upload/path/to/file 형식
    const directMatch = url.match(new RegExp(`storage\\.googleapis\\.com/${bucketName}/(.+?)(?:\\?|$)`));
    if (directMatch) {
      return decodeURIComponent(directMatch[1]);
    }
    
    // https://storage.cloud.google.com/createtree-upload/path/to/file 형식
    const cloudMatch = url.match(new RegExp(`storage\\.cloud\\.google\\.com/${bucketName}/(.+?)(?:\\?|$)`));
    if (cloudMatch) {
      return decodeURIComponent(cloudMatch[1]);
    }
    
    return null;
  } catch (e) {
    console.error('[extractGCSPathFromUrl] 오류:', e);
    return null;
  }
}

/**
 * GCS에서 파일 다운로드 (인증된 방식)
 * @param gcsPath - GCS 파일 경로 (예: 'images/family_img/0/0/0/24/file.webp')
 * @returns Promise<{buffer: Buffer, contentType: string}> - 파일 데이터와 contentType
 */
export async function downloadFromGCS(gcsPath: string): Promise<{buffer: Buffer, contentType: string}> {
  if (!storage) {
    throw new Error('GCS 클라이언트가 초기화되지 않았습니다');
  }
  
  const bucketName = 'createtree-upload';
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(gcsPath);
  
  // 파일 존재 확인
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`파일이 존재하지 않습니다: ${gcsPath}`);
  }
  
  // 메타데이터에서 contentType 가져오기
  const [metadata] = await file.getMetadata();
  const contentType = metadata.contentType || 'application/octet-stream';
  
  // 파일 다운로드
  const [buffer] = await file.download();
  
  console.log(`✅ [GCS] 파일 다운로드 완료: ${gcsPath} (${buffer.length} bytes)`);
  
  return { buffer, contentType };
}

/**
 * GCS 파일 삭제 함수
 * @param gcsPath - 삭제할 파일의 GCS 경로 (예: 'music/111_1749908489555.mp3')
 * @returns Promise<void>
 */
export async function deleteGcsObject(gcsPath: string): Promise<void> {
  const bucketName = 'createtree-upload';
  console.log('🗑️ [GCS] 파일 삭제 시작:', { bucketName, gcsPath });
  
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(gcsPath);
  
  // 파일 존재 여부 확인
  const [exists] = await file.exists();
  if (!exists) {
    console.log('⚠️ [GCS] 파일이 존재하지 않음:', gcsPath);
    return;
  }
  
  // 파일 삭제
  await file.delete();
  console.log('✅ [GCS] 파일 삭제 완료:', gcsPath);
}