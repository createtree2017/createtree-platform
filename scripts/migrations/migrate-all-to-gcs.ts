/**
 * 모든 외부 URL 음악을 GCS로 마이그레이션
 * Suno URL과 TopMediai URL을 모두 GCS로 다운로드하여 저장
 */

import { db } from '../../db';
import { music } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { Storage } from '@google-cloud/storage';

// GCS 설정
const serviceAccountKey = {
  type: "service_account",
  project_id: "createtreeai", 
  private_key_id: "5ae3581cc6a4ccdc012c18c0775fdd51614eee24",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCevUl+Y5xGrsVR\nhWJvr8stawdae+MWgy85E/zHKqN660EOjqY643Y//gp07NIb0XuJWTMbJcZYNLxi\nTcczDyggqPYn2UQUbdKIpp0XbiYkD/GLo1Hqi3CVPsIRa1xRT70S5Yx9q9rkAbxB\n+eF8gdxXQ8y+eIIhJRauZTbK7g5+f9Df8TRyjfofI8WZRNPXsQhqfpwQbp8VJwL8\nDCp7cXI2vIrCq7SbxlD02vdsaSQ97DGVIBF7Nr6QE6otSBxl4fqHYjmx6RfCAynz\nHWH1nOuYxkYszhDjawsVEaXjuGCa6SAzKmgHWaoXAM6V692lm+VLx9/1EO9b+r2I\nzJj5ak2/AgMBAAECggEAC+cRZWU7TBkbWY80JnMniHqZUA5KPlKZQWEZMXPy7MR9\ns2vV1URfn9FakyuvK3/SXaYIs3uD7lkLjesOfNEhOj9N4208PueA0FdLhmMiszSK\ncTG08qHNaZtz+mtmJJpJvDd/7wWdjnHLRHH9fhQ2SeLSR0i9wfxIDmaV37LokLdb\n9+nnoGxvDPnJKDbwXXB6gv7CL2VDAKGkSEEoqE5MnwfdCmEZwSvpYzHG4qxGuIrr\nc5JCxNkW9ib4UBBTG+S94quykzpD7MSSaP4BTEOhyx/bUA8zJwk8TW5f5vsavtxB\n6nyuo+kBS6ow4JVxFgIAs9R1MsvCBpu+OAwnHO4rnQKBgQDKtjIJf19ZccoHTndV\nAsjagQp6hibvDGelVNxq7pQDnZj2z8NH/lEX5KbAyhSHWURi/FHgzmuCybFZqs8d\nsuQd+MJekwsOYs7IONq00Pi9QE1xLMt4DCLhPj29BVa3Rn88/RcQOkCgcITKGs7+\nopqEnJDVKutEXKlykAH3qR0dewKBgQDId+gAwGLpWWMdDuTIcBR9GldUJyAMdMz3\nlWODsJK4n6V9G7I2ZA5iYn1nGHE5SAegKkOxiWRsbJzAUxhy3WedkC7Ws5yvmEkH\nNDggq6uEqf+AOEWnMPV166FoMkULVn9MwNym+GbqCRMt6dL12Px0Q+bBz+qUp9IH\nUQq62KfjjQKBgEg6CLQXnSqqf5iA3cX9ewFXzxr+56pvGhLvnKXBIh3zrkfqmSLy\nu4Qu5Td2CUB8jwBR9P6LrgToxnczhB6J2fvP4bl+3QagMBtpHowklSwhWDaGBm1c\nraTh32+VEmO1C6r4ZppSlypTTQ0R5kUWPMYZXwWFCFTQS1PVec37hLM3AoGBALGM\nYVKpEfGSVZIa6s4LVlomxkmmDWB64j41dVnhPVF/M9bGfORnYcYJbP+uSjltbjOQ\nuzu2b9cHqx07e1/gcDDAznshwRhUS/mxajSlVte8qKorLKWTWxMBiob6XuRXy49z\nEPpg7uVA/FehzFIpyA5BRVNKjnzy1bXdNR+fW7LRAoGBAK9yAL+ER3fIIHAHrYkd\nwOo4Agd6gRfVPpR2VclOWgwfG6vCiIccx+j9n4G2muJd5L0ZLGqOQMfKy4WjHdBR\n/SHg1s7YhbtVtddwdluSobZ03q6hztqMkejOaemngTMSvGOk8jlyFfmrgU0OcClf\nEoJ2Uh1U2PmPz9iZuyUI2GA\n-----END PRIVATE KEY-----\n",
  client_email: "upload-server@createtree.iam.gserviceaccount.com",
  client_id: "115537304083050477734",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/upload-server%40createtree.iam.gserviceaccount.com"
};

const storage = new Storage({
  projectId: 'createtreeai',
  credentials: serviceAccountKey
});

const bucket = storage.bucket('createtree-upload');

async function uploadToGCS(musicId: number, originalUrl: string): Promise<string | null> {
  try {
    console.log(`📤 GCS 업로드 시작: ID ${musicId}`);
    
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(originalUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok || !response.body) {
      throw new Error(`파일 다운로드 실패: ${response.statusText}`);
    }
    
    const timestamp = Date.now();
    const gcsFileName = `${musicId}_${timestamp}.mp3`;
    const gcsFilePath = `music/${gcsFileName}`;
    
    const file = bucket.file(gcsFilePath);
    const stream = file.createWriteStream({
      metadata: {
        contentType: 'audio/mpeg',
        cacheControl: 'public, max-age=31536000'
      }
    });
    
    await new Promise((resolve, reject) => {
      response.body!.pipe(stream)
        .on('error', reject)
        .on('finish', resolve);
    });
    
    // 공개 접근 설정
    await file.makePublic();
    
    const gcsUrl = `https://storage.cloud.google.com/createtree-upload/${gcsFilePath}`;
    console.log(`✅ GCS 업로드 완료: ${gcsUrl}`);
    
    return gcsUrl;
    
  } catch (error) {
    console.error(`❌ GCS 업로드 실패: ID ${musicId}`, error);
    return null;
  }
}

async function migrateAllToGCS() {
  try {
    console.log('🎵 모든 외부 URL 음악을 GCS로 마이그레이션 시작');
    
    // GCS가 아닌 완료된 음악들 조회
    const externalMusic = await db.query.music.findMany({
      where: eq(music.status, 'completed'),
      columns: {
        id: true,
        title: true,
        url: true
      }
    });
    
    const nonGCSMusic = externalMusic.filter(m => 
      m.url && !m.url.includes('storage.cloud.google.com')
    );
    
    console.log(`📋 마이그레이션 대상: ${nonGCSMusic.length}개`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const musicRecord of nonGCSMusic) {
      console.log(`🔄 처리 중: ID ${musicRecord.id} - ${musicRecord.title}`);
      
      const gcsUrl = await uploadToGCS(musicRecord.id, musicRecord.url);
      
      if (gcsUrl) {
        // DB URL 업데이트
        await db.update(music)
          .set({
            url: gcsUrl,
            updatedAt: new Date()
          })
          .where(eq(music.id, musicRecord.id));
        
        successCount++;
        console.log(`✅ 성공: ID ${musicRecord.id}`);
      } else {
        failCount++;
        console.log(`❌ 실패: ID ${musicRecord.id}`);
      }
    }
    
    console.log(`\n🎉 마이그레이션 완료!`);
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${failCount}개`);
    
    // 최종 GCS 음악 확인
    const gcsMusic = await db.query.music.findMany({
      where: eq(music.status, 'completed'),
      columns: { id: true, title: true, url: true }
    });
    
    const gcsCount = gcsMusic.filter(m => 
      m.url && m.url.includes('storage.cloud.google.com')
    ).length;
    
    console.log(`📊 최종 GCS 음악 개수: ${gcsCount}개`);
    
  } catch (error) {
    console.error('❌ 마이그레이션 중 오류:', error);
  }
}

migrateAllToGCS();