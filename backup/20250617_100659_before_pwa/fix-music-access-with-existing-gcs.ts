/**
 * 기존 GCS 설정을 사용하여 음악 파일 공개 접근 권한 설정
 */

import { Storage } from '@google-cloud/storage';

// 기존 GCS 설정 사용
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

async function fixMusicAccess() {
  console.log('음악 파일 접근 권한 수정 시작');
  
  const bucketName = 'createtree-upload';
  const fileName = 'music/cd94a531-dd3b-4a3f-ae48-c635f3788051.mp3';
  
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileName);
  
  try {
    // 파일 존재 확인
    const [exists] = await file.exists();
    if (!exists) {
      console.log('파일이 존재하지 않습니다:', fileName);
      return;
    }
    
    console.log('파일 존재 확인됨:', fileName);
    
    // 공개 읽기 권한 설정
    await file.makePublic();
    console.log('공개 접근 권한 설정 완료');
    
    // 공개 URL 확인
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
    console.log('공개 URL:', publicUrl);
    
    // URL 접근 테스트
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(publicUrl, { method: 'HEAD' });
    
    console.log('접근 테스트 결과:');
    console.log('- 상태:', response.status, response.statusText);
    console.log('- Content-Type:', response.headers.get('content-type'));
    console.log('- Content-Length:', response.headers.get('content-length'));
    
    if (response.ok) {
      console.log('음악 파일 접근 성공! 이제 재생 가능합니다.');
      console.log('새 URL:', publicUrl);
    } else {
      console.log('여전히 접근 불가능합니다.');
    }
    
  } catch (error: any) {
    console.error('권한 설정 실패:', error.message);
  }
}

fixMusicAccess().catch(console.error);