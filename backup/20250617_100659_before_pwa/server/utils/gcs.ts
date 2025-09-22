import { Storage } from '@google-cloud/storage';
import https from 'https';
import http from 'http';
import dotenv from 'dotenv';

// .env 파일 로딩
dotenv.config();

// Firebase 서비스 계정 키 직접 설정
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

/**
 * GCS 업로드 모듈 - 작업지시서 기준
 */
export async function uploadToGCS(remoteUrl: string, targetPath: string): Promise<string> {
  const bucketName = 'createtree-upload';
  console.log('GCS 버킷명:', bucketName);
  
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(targetPath);
  
  return new Promise((resolve, reject) => {
    const client = remoteUrl.startsWith('https:') ? https : http;
    
    client.get(remoteUrl, (response) => {
      if (!response.statusCode || response.statusCode !== 200) {
        reject(new Error(`Failed to fetch: ${response.statusCode}`));
        return;
      }
      
      const writeStream = file.createWriteStream({
        metadata: {
          contentType: 'audio/mpeg',
        }
      });
      
      response.pipe(writeStream)
        .on('error', reject)
        .on('finish', () => {
          resolve(`https://storage.googleapis.com/createtree-upload/${targetPath}`);
        });
    }).on('error', reject);
  });
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