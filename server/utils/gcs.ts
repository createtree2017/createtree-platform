import { Storage } from '@google-cloud/storage';
import https from 'https';
import http from 'http';
import dotenv from 'dotenv';

// .env 파일 로딩
dotenv.config();

// GCS Storage 클라이언트 - 환경변수 기반 인증 방식 복구
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n')
  }
});

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
      
      // 🚨 SECURITY: 의료 환경에서는 공개 권한 설정 금지 (HIPAA 준수)
      // await bucket.makePublic(); // 의료 데이터 보호를 위해 완전 차단
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
            
            // 🚨 SECURITY: 의료 환경에서는 공개 접근 권한 설정 금지 (HIPAA 준수)
            // try {
            //   await file.makePublic(); // 의료 데이터 보호를 위해 완전 차단
            //   console.log(`🌐 [GCS] 공개 접근 권한 설정 완료`);
            // } catch (permError) {
            //   console.log(`⚠️ [GCS] 권한 설정 오류:`, permError);
            // }
            console.log(`🔒 [GCS] 의료 데이터 보안: Private 모드로 저장됨`);
            
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
 * @returns Promise<string> - 업로드된 파일의 공개 URL
 */
export async function uploadBufferToGCS(buffer: Buffer, targetPath: string, contentType: string = 'image/png'): Promise<string> {
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
    
    // 🚨 SECURITY: 의료 환경에서는 공개 접근 권한 설정 금지 (HIPAA 준수)
    // try {
    //   await file.makePublic(); // 의료 데이터 보호를 위해 완전 차단
    //   console.log(`🌐 [GCS] 공개 접근 권한 설정 완료`);
    // } catch (permError) {
    //   console.log(`⚠️ [GCS] 권한 설정 스킵:`, permError.message);
    // }
    console.log(`🔒 [GCS] 의료 데이터 보안: Private 모드로 저장됨`);
    
    const gcsUrl = `https://storage.googleapis.com/${bucketName}/${targetPath}`;
    console.log(`📎 [GCS] 공개 URL: ${gcsUrl}`);
    return gcsUrl;
    
  } catch (error) {
    console.error(`❌ [GCS] 업로드 실패:`, error);
    throw error;
  }
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