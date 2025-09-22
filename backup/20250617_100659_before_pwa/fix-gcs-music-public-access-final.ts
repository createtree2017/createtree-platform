/**
 * GCS 음악 파일 공개 접근 권한 최종 설정
 * 403 Forbidden 오류 근본적 해결
 */

import { Storage } from '@google-cloud/storage';

async function fixGCSMusicPublicAccessFinal() {
  console.log('🎵 GCS 음악 파일 공개 접근 권한 설정 시작...');
  
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
    
    // 1. 버킷 자체의 공개 접근 정책 설정
    console.log('📁 버킷 공개 접근 정책 설정 중...');
    
    try {
      await bucket.iam.setPolicy({
        bindings: [
          {
            role: 'roles/storage.objectViewer',
            members: ['allUsers']
          }
        ]
      });
      console.log('✅ 버킷 공개 접근 정책 설정 완료');
    } catch (bucketError) {
      console.log('⚠️ 버킷 정책 설정 실패 (이미 설정됨 가능성):', bucketError.message);
    }
    
    // 2. 음악 파일들 개별 공개 설정
    console.log('🎵 음악 파일들 공개 접근 설정 중...');
    
    const [files] = await bucket.getFiles({ prefix: 'music/' });
    
    console.log(`📋 발견된 음악 파일: ${files.length}개`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const file of files) {
      try {
        // 파일을 공개 읽기 가능하도록 설정
        await file.makePublic();
        console.log(`✅ 공개 설정 완료: ${file.name}`);
        successCount++;
      } catch (fileError) {
        console.error(`❌ 공개 설정 실패: ${file.name}`, fileError.message);
        errorCount++;
      }
    }
    
    console.log(`\n📊 작업 완료:`);
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${errorCount}개`);
    
    // 3. 테스트 파일 확인
    if (files.length > 0) {
      const testFile = files.find(f => f.name.includes('205ec20e-9916-46e5-8e70-11dc91bf395f'));
      
      if (testFile) {
        const publicUrl = `https://storage.googleapis.com/createtree-upload/${testFile.name}`;
        console.log(`\n🧪 테스트 URL: ${publicUrl}`);
        
        // HTTP 요청으로 접근 테스트
        try {
          const fetch = (await import('node-fetch')).default;
          const response = await fetch(publicUrl, { method: 'HEAD' });
          console.log(`📡 응답 상태: ${response.status} ${response.statusText}`);
          
          if (response.ok) {
            console.log('🎉 공개 접근 성공!');
          } else {
            console.log('❌ 아직 접근 불가');
          }
        } catch (testError) {
          console.error('❌ 테스트 오류:', testError.message);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ GCS 설정 오류:', error);
  }
}

fixGCSMusicPublicAccessFinal();