/**
 * 모든 Suno URL 음악을 GCS로 즉시 다운로드
 * 불안정한 Suno URL 문제 완전 해결
 */

import { db } from './db/index';
import { music } from './shared/schema';
import { eq, and } from 'drizzle-orm';

async function downloadSunoToGCS(musicId: number, sunoUrl: string): Promise<string | null> {
  try {
    console.log(`🔄 [GCS] 음악 ${musicId} 다운로드 시작:`, sunoUrl);
    
    // Step 1: Suno URL에서 오디오 파일 다운로드
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(sunoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'audio/*,*/*;q=0.9',
        'Referer': 'https://suno.com/'
      }
    });

    if (!response.ok) {
      console.error(`❌ [GCS] 음악 ${musicId} 다운로드 실패:`, response.status);
      return null;
    }

    const audioBuffer = await response.buffer();
    console.log(`📦 [GCS] 음악 ${musicId} 버퍼 크기:`, audioBuffer.length);

    // Step 2: GCS에 업로드
    const { Storage } = await import('@google-cloud/storage');
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
    const fileName = `music_${musicId}_${Date.now()}.mp3`;
    const file = bucket.file(`music/${fileName}`);

    // Step 3: GCS에 업로드 (공개 읽기 권한 포함)
    await file.save(audioBuffer, {
      metadata: {
        contentType: 'audio/mpeg',
        cacheControl: 'public, max-age=31536000'
      },
      public: true
    });

    const gcsUrl = `https://storage.googleapis.com/createtree-upload/music/${fileName}`;
    console.log(`✅ [GCS] 음악 ${musicId} 업로드 완료:`, gcsUrl);

    // Step 4: DB 업데이트
    await db.update(music)
      .set({ 
        url: gcsUrl,
        metadata: JSON.stringify({
          originalSunoUrl: sunoUrl,
          gcsFileName: fileName,
          downloadedAt: new Date().toISOString(),
          source: 'suno_to_gcs_migration'
        })
      })
      .where(eq(music.id, musicId));

    console.log(`📝 [GCS] 음악 ${musicId} DB 업데이트 완료`);
    return gcsUrl;

  } catch (error: any) {
    console.error(`❌ [GCS] 음악 ${musicId} 처리 실패:`, error.message);
    return null;
  }
}

async function fixAllSunoMusic() {
  try {
    console.log('🔍 [Migration] Suno URL 음악 검색 중...');
    
    // 모든 Suno URL 음악 조회
    const sunoMusicList = await db.query.music.findMany({
      where: and(
        eq(music.status, 'completed'),
        // Suno URL 패턴 매칭은 SQL에서 할 수 없으므로 모든 완료된 음악을 가져와서 필터링
      ),
      columns: {
        id: true,
        url: true,
        title: true,
        createdAt: true
      },
      orderBy: (music, { desc }) => [desc(music.createdAt)]
    });

    // Suno URL만 필터링
    const sunoUrls = sunoMusicList.filter(m => 
      m.url && (
        m.url.includes('audiopipe.suno.ai') || 
        m.url.includes('suno.') ||
        m.url.includes('cdn.suno.ai')
      )
    );

    console.log(`📊 [Migration] 발견된 Suno URL 음악: ${sunoUrls.length}개`);
    
    if (sunoUrls.length === 0) {
      console.log('✅ [Migration] 마이그레이션할 Suno URL이 없습니다.');
      return;
    }

    // 각 음악 처리 (병렬 처리로 속도 향상)
    let successCount = 0;
    let failCount = 0;

    const promises = sunoUrls.map(async (musicItem) => {
      const result = await downloadSunoToGCS(musicItem.id, musicItem.url!);
      if (result) {
        successCount++;
        console.log(`✅ [Migration] 성공: ${musicItem.title} (ID: ${musicItem.id})`);
      } else {
        failCount++;
        console.log(`❌ [Migration] 실패: ${musicItem.title} (ID: ${musicItem.id})`);
      }
    });

    await Promise.all(promises);

    console.log(`
🎯 [Migration] 완료 요약:
- 총 처리 대상: ${sunoUrls.length}개
- 성공: ${successCount}개
- 실패: ${failCount}개
- 성공률: ${Math.round((successCount / sunoUrls.length) * 100)}%
    `);

  } catch (error: any) {
    console.error('❌ [Migration] 전체 프로세스 실패:', error.message);
  }
}

// 실행
fixAllSunoMusic().then(() => {
  console.log('🏁 [Migration] 마이그레이션 작업 종료');
  process.exit(0);
}).catch((error) => {
  console.error('💥 [Migration] 마이그레이션 실패:', error);
  process.exit(1);
});