/**
 * GCS 폴더 구조 마이그레이션 최종 실행
 * 기존: images/category/userId/file.ext
 * 신규: images/category/hash1/hash2/hash3/userId/file.ext
 */

import { Storage } from '@google-cloud/storage';
import { db } from './db/index.js';
import { images } from './shared/schema.js';
import { eq } from 'drizzle-orm';

// 검증된 작동하는 GCS 설정
const serviceAccountKey = {
  type: "service_account",
  project_id: "createtreeai",
  private_key_id: "3f4c8d2f7fd430aa6c9b8ad2eafa7d618c97ef50",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCMFLhD2zY3YrmO\nerz5xoj6OuW0a0g9ahOrq0gbXCBkTDwi1fll2NlgPqS9HmgDVP28ra8rU1uceoIi\nFA/0jjqpBcpj03xIaBauheEzcXELVqJly/AvLJ9iFL4443QRHWlXaOxKQRyhnWpX\nNOtuQ3TuvBd3zL8enqOD/DtLmabygk7m/StI5TRiIgX2Hkui1Jje4OkxwTdRR4d3\nQGmh0KGscqWf/oN9tCHHSorOc80Uw8u7WxXcBqpvMnxnVbe6b/M37NSyC8F+9xjG\n8z4TZh/vFRtl5ZpHV++ygtD4meYJJmD8TRBykI2YRw4u2T/Kw/ilpVEaBLVv3eGf\nc4yh/zJbAgMBAAECggEAIKRNYeaJhjN3qMdaFNwaHDEwSK/9J+55gfXKOjHoDGcl\nVjrFQGHdGYvPaJBWzXv3GongeTiV7usvOtCw/RxNeAh05nkoC1lR+74PwaSMIofA\nFPeGUv/TbhAGWYxLBhfz7Z3x/cWZbeGYH5UhzVJjw6PJ1i08Vd7CnKVgjdfSqsyx\nUfz2lK9jzsgNdEnB+qUxkybGT3/AJ2/KxFh3ldpKy72bEQ7NTr6M8OXSIDsPAsYx\nfRxQDp68Ftfm5E2YR5aeZZ32aXpIRurhfAKce04qVHVs2BWLeCUQPVaWXp3JgjY8\n6OwYOeEm8V5gL5kpcFkNGJSjAiWg5YMaX9q0bgv0YQKBgQDFCWsXXSodtAUXL1Iq\nv4xIsG2GK8A8J9V7LhuUu0CBqafYYOfE8vMxhkSXpe7j5k9SZy13SzKRIg3pquPc\nwv7p68hf/J96t/XYSfUSab5gYetsbCbAzjUF9RokFzJE0YKskyfxTKhUPQMSe9z4\nIedKgKqK7SXhArFqOM+kJnZg+wKBgQC2AAf216yQOB5rsvAQfJI11zEwekf2aAgx\nafzPf1yxYZtW/ueQ/tdwpyptIHhAJMVRliDPOOIznCXxnv3vofE5o4GmlJJ1efd7\nBwDLTPGSQ28LdVFTbllC7i85YvtrvhoNHoGtb1t7lnfQc03u33XJ0YDJVJSNFGdm\nRyp6j8t2IQKBgCdBfh2UiSyLzivVWLh9mzRsOhXuJ4mUohq9j+8s82gh5ffdLq/1\ne3BVgNr5y0OKgik3tz46NCPoNf9k9arpCqKOQEinaxqnBgsGiRYXDT/komPilEH7\nk2LRd1jTakd9ulwpoV6Y2DyYP0Fyfg7NqmgUhGXTY6WVxMUV9oCMzS77AoGAVmzD\nW2tlTYLopznsl9ef0qNif2PB4nfaVCTBYYNYb/8qtfAL5KWvhpZLJlEB6WvMq4aA\nBAc+G0XuGsPmUDH1i+ph+cmZluGZLLnRnbjnCg6tn6JRQS4ogwj6MeUYATzfwBUZ\nfVNg/NoiAUGP43wHwhOTdYeNl0T2KPJocJTyCCECgYBmhAyPU6CNdWcPRn2J+zAY\nujo3dC6X1W8P/nVEBfITlBqeChfVpr+fLjjbr7RTGD71hPOF/QQDSJR9N+Y08bHy\nd8Dumx53/imlMGLKpT0RmHRSiUUJnP55iF4Ec8Qu8AfCS04uv/jzRyfVZmY9Szje\nEh5xUY0Qa1ERWA22GDbV4Q==\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@createtreeai.iam.gserviceaccount.com",
  client_id: "102084305108881637331",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40createtreeai.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

const storage = new Storage({
  projectId: 'createtreeai',
  credentials: serviceAccountKey
});

const bucket = storage.bucket('createtree-upload');

/**
 * 사용자 ID를 해시 기반 경로로 변환
 */
function generateHashPath(userId: string): string {
  const hash = userId.padStart(6, '0'); // 최소 6자리로 패딩
  return `${hash[0]}/${hash[1]}/${hash[2]}`;
}

/**
 * 기존 경로를 새 경로로 변환
 */
function convertToNewPath(oldPath: string): { newPath: string; isAlreadyNew: boolean } {
  // 기존 형태: images/category/userId/filename
  // 새 형태: images/category/h1/h2/h3/userId/filename
  
  const parts = oldPath.split('/');
  
  if (parts.length < 4) {
    return { newPath: oldPath, isAlreadyNew: false };
  }
  
  // 이미 새 형태인지 확인 (5개 이상의 세그먼트가 있고 숫자로만 구성된 경로)
  if (parts.length >= 6 && /^\d$/.test(parts[2]) && /^\d$/.test(parts[3]) && /^\d$/.test(parts[4])) {
    return { newPath: oldPath, isAlreadyNew: true };
  }
  
  const [images, category, userId, ...filename] = parts;
  const hashPath = generateHashPath(userId);
  const newPath = `${images}/${category}/${hashPath}/${userId}/${filename.join('/')}`;
  
  return { newPath, isAlreadyNew: false };
}

/**
 * 마이그레이션 실행
 */
async function executeGCSMigration() {
  console.log('🚀 GCS 폴더 구조 마이그레이션 시작...\n');
  
  let totalFiles = 0;
  let migratedFiles = 0;
  let alreadyNewFiles = 0;
  let errors = 0;
  
  try {
    // 1. 모든 이미지 파일 조회
    console.log('📋 데이터베이스에서 이미지 목록 조회...');
    const allImages = await db.select().from(images);
    console.log(`   총 ${allImages.length}개 이미지 발견\n`);
    
    // 2. 각 이미지 처리
    for (const image of allImages) {
      totalFiles++;
      
      console.log(`[${totalFiles}/${allImages.length}] 처리 중: ID ${image.id}`);
      
      try {
        // 원본 이미지 처리
        if (image.originalUrl && image.originalUrl.includes('createtree-upload/')) {
          const originalGcsPath = image.originalUrl.split('createtree-upload/')[1];
          const { newPath: newOriginalPath, isAlreadyNew: originalAlreadyNew } = convertToNewPath(originalGcsPath);
          
          if (!originalAlreadyNew && originalGcsPath !== newOriginalPath) {
            console.log(`   원본: ${originalGcsPath} → ${newOriginalPath}`);
            
            // 파일 복사
            await bucket.file(originalGcsPath).copy(bucket.file(newOriginalPath));
            
            // 공개 권한 설정
            await bucket.file(newOriginalPath).makePublic();
            
            // URL 업데이트
            const newOriginalUrl = image.originalUrl.replace(originalGcsPath, newOriginalPath);
            await db.update(images)
              .set({ originalUrl: newOriginalUrl })
              .where(eq(images.id, image.id));
            
            migratedFiles++;
          } else if (originalAlreadyNew) {
            alreadyNewFiles++;
            console.log(`   원본: 이미 새 형태`);
          }
        }
        
        // 썸네일 이미지 처리
        if (image.thumbnailUrl && image.thumbnailUrl.includes('createtree-upload/')) {
          const thumbnailGcsPath = image.thumbnailUrl.split('createtree-upload/')[1];
          const { newPath: newThumbnailPath, isAlreadyNew: thumbnailAlreadyNew } = convertToNewPath(thumbnailGcsPath);
          
          if (!thumbnailAlreadyNew && thumbnailGcsPath !== newThumbnailPath) {
            console.log(`   썸네일: ${thumbnailGcsPath} → ${newThumbnailPath}`);
            
            // 파일 복사
            await bucket.file(thumbnailGcsPath).copy(bucket.file(newThumbnailPath));
            
            // 공개 권한 설정
            await bucket.file(newThumbnailPath).makePublic();
            
            // URL 업데이트
            const newThumbnailUrl = image.thumbnailUrl.replace(thumbnailGcsPath, newThumbnailPath);
            await db.update(images)
              .set({ thumbnailUrl: newThumbnailUrl })
              .where(eq(images.id, image.id));
          } else if (thumbnailAlreadyNew) {
            console.log(`   썸네일: 이미 새 형태`);
          }
        }
        
        console.log(`   ✅ 완료\n`);
        
      } catch (error) {
        console.error(`   ❌ 오류: ${error}\n`);
        errors++;
      }
    }
    
    // 3. 마이그레이션 결과 출력
    console.log('\n🎯 마이그레이션 완료!');
    console.log(`📊 결과 요약:`);
    console.log(`   • 총 파일 수: ${totalFiles}`);
    console.log(`   • 마이그레이션 완료: ${migratedFiles}`);
    console.log(`   • 이미 새 형태: ${alreadyNewFiles}`);
    console.log(`   • 오류 발생: ${errors}`);
    
    if (errors === 0) {
      console.log('\n✅ 모든 파일이 성공적으로 마이그레이션되었습니다!');
      console.log('🔧 이제 gcs-image-storage.ts에서 새 폴더 구조를 사용하도록 업데이트합니다.');
    } else {
      console.log(`\n⚠️ ${errors}개 파일에서 오류가 발생했습니다. 로그를 확인해주세요.`);
    }
    
  } catch (error) {
    console.error('❌ 마이그레이션 실행 중 오류:', error);
  }
}

// 실행
executeGCSMigration().catch(console.error);