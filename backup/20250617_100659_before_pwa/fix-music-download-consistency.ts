/**
 * 음악 다운로드 일관성 수정
 * 모든 음악을 GCS URL로 통일하여 동일한 다운로드 방식 적용
 */

import { db } from './db/index.js';
import { music } from './shared/schema.js';
import { eq } from 'drizzle-orm';
import { Storage } from '@google-cloud/storage';

async function fixMusicDownloadConsistency() {
  console.log('🎵 음악 다운로드 일관성 수정 시작...');
  
  try {
    // GCS 설정
    const serviceAccountKey = {
      type: "service_account",
      project_id: "createtreeai", 
      private_key_id: "5ae3581cc6a4ccdc012c18c0775fdd51614eee24",
      private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCevUl+Y5xGrsVR\nhWJvr8stawdae+MWgy85E/zHKqN660EOjqY643Y//gp07NIb0XuJWTMbJcZYNLxi\nTcczDyggqPYn2UQUbdKIpp0XbiYkD/GLo1Hqi3CVPsIRa1xRT70S5Yx9q9rkAbxB\n+eF8gdxXQ8y+eIIhJRauZTbK7g5+f9Df8TRyjfofI8WZRNPXsQhqfpwQbp8VJwL8\nDCp7cXI2vIrCq7SbxlD02vdsaSQ97DGVIBF7Nr6QE6otSBxl4fqHYjmx6RfCAynz\nHWH1nOuYxkYszhDjawsVEaXjuGCa6SAzKmgHWaoXAM6V692lm+VLx9/1EO9b+r2I\nzJj5ak2/AgMBAAECggEAC+cRZWU7TBkbWY80JnMniHqZUA5KPlKZQWEZMXPy7MR9\ns2vV1URfn9FakyuvK3/SXaYIs3uD7lkLjesOfNEhOj9N4208PueA0FdLhmMiszSK\ncTG08qHNaZtz+mtmJJpJvDd/7wWdjnHLRHH9fhQ2SeLSR0i9wfxIDmaV37LokLdb\n9+nnoGxvDPnJKDbwXXB6gv7CL2VDAKGkSEEoqE5MnwfdCmEZwSvpYzHG4qxGuIrr\nc5JCxNkW9ib4UBBTG+S94quykzpD7MSSaP4BTEOhyx/bUA8zJwk8TW5f5vsavtxB\n6nyuo+kBS6ow4JVxFgIAs9R1MsvCBpu+OAwnHO4rnQKBgQDKtjIJf19ZccoHTndV\nAsjagQp6hibvDGelVNxq7pQDnZj2z8NH/lEX5KbAyhSHWURi/FHgzmuCybFZqs8d\nsuQd+MJekwsOYs7IONq00Pi9QE1xLMt4DCLhPj29BVa3Rn88/RcQOkCgcITKGs7+\nopqEnJDVKutEXKlykAH3qR0dewKBgQDId+gAwGLpWWMdDuTIcBR9GldUJyAMdMz3\nlWODsJK4n6V9G7I2ZA5iYn1nGHE5SAegKkOxiWRsbJzAUxhy3WedkC7Ws5yvmEkH\nNDggq6uEqf+AOEWnMPV166FoMkULVn9MwNym+GbqCRMt6dL12Px0Q+bBz+qUp9IH\nUQq62KfjjQKBgEg6CLQXnSqqf5iA3cX9ewFXzxr+56pvGhLvnKXBIh3zrkfqmSLy\nu4Qu5Td2CUB8jwBR9P6LrgToxnczhB6J2fvP4bl+3QagMBtpHowklSwhWDaGBm1c\nraTh32+VEmO1C6r4ZppSlypTTQ0R5kUWPMYZXwWFCFTQS1PVec37hLM3AoGBALGM\nYVKpEfGSVZIa6s4LVlomxkmmDWB64j41dVnhPVF/M9bGfORnYcYJbP+uSjltbjOQ\nuzu2b9cHqx07e1/gcDDAznshwRhUS/mxajSlVte8qKorLKWTWxMBiob6XuRXy49z\nEPpg7uVA/FehzFIpyA5BRVNKjnzy1bXdNR+fW7LRAoGBAK9yAL+ER3fIIHAHrYkd\nwOo4Agd6gRfVPpR2VclOWgwfG6vCiIccx+j9n4G2muJd5L0ZLGqOQMfKy4WjHdBR\n/SHg1s7YhbtVtddwdluSobZ03q6hztqMkejOaemngTMSvGOk8jlyFfmrgU0OcClf\nnEoJ2Uh1U2PmPz9iZuyUI2GA\n-----END PRIVATE KEY-----\n",
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
    
    // Suno URL을 가진 음악들 조회
    const sunoMusicList = await db.query.music.findMany({
      where: (music, { like }) => like(music.url, '%audiopipe.suno.ai%'),
      orderBy: (music, { desc }) => desc(music.id)
    });
    
    console.log(`📋 Suno URL 음악 개수: ${sunoMusicList.length}`);
    
    for (const musicItem of sunoMusicList) {
      console.log(`\n🎵 처리 중: ${musicItem.title} (ID: ${musicItem.id})`);
      
      // Suno URL에서 item_id 추출
      const urlMatch = musicItem.url?.match(/item_id=([a-f0-9-]+)/);
      if (!urlMatch) {
        console.log('❌ item_id를 추출할 수 없습니다.');
        continue;
      }
      
      const itemId = urlMatch[1];
      const gcsFileName = `${itemId}.mp3`;
      const gcsFilePath = `music/${gcsFileName}`;
      
      try {
        // GCS에 파일이 존재하는지 확인
        const [exists] = await bucket.file(gcsFilePath).exists();
        
        if (exists) {
          // GCS URL로 업데이트
          const gcsUrl = `https://storage.googleapis.com/createtree-upload/${gcsFilePath}`;
          
          await db.update(music)
            .set({ 
              url: gcsUrl,
              updatedAt: new Date()
            })
            .where(eq(music.id, musicItem.id));
          
          console.log(`✅ GCS URL로 업데이트: ${gcsUrl}`);
          
        } else {
          console.log(`⏳ GCS 파일이 아직 없음: ${gcsFilePath}`);
          
          // Suno URL에서 오디오 파일 다운로드하여 GCS에 저장
          const fetch = (await import('node-fetch')).default;
          
          const audioResponse = await fetch(musicItem.url!, {
            redirect: 'follow',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (audioResponse.ok && audioResponse.body) {
            const file = bucket.file(gcsFilePath);
            const stream = file.createWriteStream({
              metadata: {
                contentType: 'audio/mpeg',
                cacheControl: 'public, max-age=31536000'
              }
            });
            
            await new Promise((resolve, reject) => {
              audioResponse.body!.pipe(stream)
                .on('error', reject)
                .on('finish', resolve);
            });
            
            // 공개 접근 설정
            await file.makePublic();
            
            // GCS URL로 업데이트
            const gcsUrl = `https://storage.googleapis.com/createtree-upload/${gcsFilePath}`;
            
            await db.update(music)
              .set({ 
                url: gcsUrl,
                updatedAt: new Date()
              })
              .where(eq(music.id, musicItem.id));
            
            console.log(`✅ 다운로드 완료 및 GCS URL 업데이트: ${gcsUrl}`);
            
          } else {
            console.log(`❌ 오디오 다운로드 실패: ${audioResponse.status}`);
          }
        }
        
      } catch (error) {
        console.error(`❌ 처리 오류 (ID: ${musicItem.id}):`, error);
      }
    }
    
    // 최종 상태 확인
    console.log('\n📊 최종 상태 확인:');
    const finalList = await db.query.music.findMany({
      where: (music, { inArray }) => inArray(music.id, sunoMusicList.map(m => m.id)),
      orderBy: (music, { desc }) => desc(music.id)
    });
    
    for (const item of finalList) {
      const urlType = item.url?.includes('storage.googleapis.com') ? 'GCS' : 'Suno';
      console.log(`${item.id}. ${item.title}: ${urlType} URL`);
    }
    
    console.log('\n✅ 음악 다운로드 일관성 수정 완료!');
    console.log('이제 모든 음악이 동일한 GCS 다운로드 방식을 사용합니다.');
    
  } catch (error) {
    console.error('❌ 수정 작업 오류:', error);
  }
}

fixMusicDownloadConsistency();