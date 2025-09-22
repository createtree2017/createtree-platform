/**
 * 음악 파일 프록시 엔드포인트 생성
 * GCS 파일을 서버를 통해 스트리밍하는 방식
 */

import { Storage } from '@google-cloud/storage';
import express from 'express';

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

// 기존 routes.ts에 추가할 엔드포인트
const musicProxyRoute = `
// 음악 파일 프록시 엔드포인트
app.get('/api/music/stream/:musicId', async (req, res) => {
  try {
    const { musicId } = req.params;
    
    // DB에서 음악 정보 조회
    const music = await db.query.music.findFirst({
      where: eq(music.id, parseInt(musicId))
    });
    
    if (!music || !music.gcs_path) {
      return res.status(404).json({ error: '음악을 찾을 수 없습니다' });
    }
    
    const bucketName = 'createtree-upload';
    const fileName = \`music/\${music.gcs_path}.mp3\`;
    
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);
    
    // 파일 존재 확인
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: '음악 파일이 존재하지 않습니다' });
    }
    
    // 파일 메타데이터 가져오기
    const [metadata] = await file.getMetadata();
    
    // 응답 헤더 설정
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': metadata.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000'
    });
    
    // 스트리밍
    const stream = file.createReadStream();
    stream.pipe(res);
    
    stream.on('error', (error) => {
      console.error('스트리밍 오류:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: '음악 스트리밍 실패' });
      }
    });
    
  } catch (error) {
    console.error('음악 스트리밍 오류:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});
`;

console.log('음악 프록시 엔드포인트 코드:');
console.log(musicProxyRoute);

async function testMusicAccess() {
  console.log('음악 파일 접근 테스트');
  
  const bucketName = 'createtree-upload';
  const fileName = 'music/cd94a531-dd3b-4a3f-ae48-c635f3788051.mp3';
  
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileName);
  
  try {
    const [exists] = await file.exists();
    console.log('파일 존재:', exists);
    
    if (exists) {
      const [metadata] = await file.getMetadata();
      console.log('파일 정보:', {
        name: metadata.name,
        size: metadata.size,
        contentType: metadata.contentType
      });
      
      console.log('프록시 URL: /api/music/stream/79');
    }
    
  } catch (error: any) {
    console.error('접근 테스트 실패:', error.message);
  }
}

testMusicAccess().catch(console.error);