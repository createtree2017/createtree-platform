/**
 * 갤러리 이미지 접근 문제 해결
 * GCS URL을 로컬 static 경로로 변경
 */
import { db } from "./db";
import { images } from "./shared/schema";
import { eq, isNotNull } from "drizzle-orm";
import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";

async function downloadImageFromGCS(gcsUrl: string, localPath: string): Promise<boolean> {
  try {
    console.log(`📥 이미지 다운로드 시도: ${gcsUrl}`);
    
    const response = await fetch(gcsUrl);
    if (!response.ok) {
      console.log(`❌ GCS 접근 실패 (${response.status}): ${gcsUrl}`);
      return false;
    }

    // 디렉토리 생성
    const dir = path.dirname(localPath);
    await fs.mkdir(dir, { recursive: true });

    // 이미지 파일 저장
    const buffer = await response.buffer();
    await fs.writeFile(localPath, buffer);
    
    console.log(`✅ 이미지 저장 완료: ${localPath}`);
    return true;
  } catch (error) {
    console.log(`❌ 다운로드 실패: ${error.message}`);
    return false;
  }
}

async function fixGalleryImages() {
  console.log('🔧 갤러리 이미지 문제 해결 시작...');

  try {
    // GCS URL을 가진 이미지들 조회
    const gcsImages = await db.select()
      .from(images)
      .where(isNotNull(images.url))
      .limit(50);

    console.log(`📊 총 ${gcsImages.length}개 이미지 처리 예정`);

    let successCount = 0;
    let errorCount = 0;

    for (const image of gcsImages) {
      try {
        const gcsUrl = image.url;
        const thumbnailUrl = image.thumbnailUrl;

        // GCS URL인지 확인
        if (gcsUrl && gcsUrl.includes('googleapis.com')) {
          // 로컬 파일 경로 생성
          const fileName = `image_${image.id}.jpg`;
          const localPath = path.join('static', 'gallery', fileName);
          const publicPath = `/static/gallery/${fileName}`;

          // 이미지 다운로드
          const success = await downloadImageFromGCS(gcsUrl, localPath);
          
          if (success) {
            // DB 업데이트 - URL을 로컬 경로로 변경
            await db.update(images)
              .set({ 
                url: publicPath,
                transformedUrl: publicPath,
                thumbnailUrl: publicPath 
              })
              .where(eq(images.id, image.id));
            
            console.log(`✅ 이미지 ${image.id} 업데이트 완료: ${publicPath}`);
            successCount++;
          } else {
            errorCount++;
          }
        }

        // 썸네일 URL도 처리
        if (thumbnailUrl && thumbnailUrl.includes('googleapis.com')) {
          const thumbFileName = `thumb_${image.id}.jpg`;
          const thumbLocalPath = path.join('static', 'gallery', thumbFileName);
          const thumbPublicPath = `/static/gallery/${thumbFileName}`;

          const thumbSuccess = await downloadImageFromGCS(thumbnailUrl, thumbLocalPath);
          
          if (thumbSuccess) {
            await db.update(images)
              .set({ thumbnailUrl: thumbPublicPath })
              .where(eq(images.id, image.id));
            
            console.log(`✅ 썸네일 ${image.id} 업데이트 완료`);
          }
        }

      } catch (error) {
        console.log(`❌ 이미지 ${image.id} 처리 실패:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 처리 완료:`);
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${errorCount}개`);

    // 갤러리 디렉토리 파일 목록 확인
    try {
      const galleryDir = path.join('static', 'gallery');
      const files = await fs.readdir(galleryDir);
      console.log(`📁 갤러리 디렉토리: ${files.length}개 파일`);
    } catch (error) {
      console.log('📁 갤러리 디렉토리 확인 실패');
    }

  } catch (error) {
    console.error('❌ 갤러리 이미지 수정 실패:', error);
  }
}

fixGalleryImages().then(() => {
  console.log('🎉 갤러리 이미지 문제 해결 완료!');
  process.exit(0);
}).catch(error => {
  console.error('💥 스크립트 실행 실패:', error);
  process.exit(1);
});