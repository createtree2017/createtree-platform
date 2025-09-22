/**
 * GCS 버킷 생성 및 테스트 스크립트
 */
import { Storage } from '@google-cloud/storage';

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

async function testGCSBucket() {
  const bucketName = 'createtree-upload';
  console.log(`GCS 버킷 테스트: ${bucketName}`);
  
  try {
    const bucket = storage.bucket(bucketName);
    
    // 버킷 존재 확인
    const [exists] = await bucket.exists();
    console.log(`버킷 존재 여부: ${exists}`);
    
    if (!exists) {
      console.log('버킷 생성 시도...');
      
      // 버킷 생성
      await bucket.create({
        location: 'ASIA-NORTHEAST3',
        storageClass: 'STANDARD'
      });
      
      console.log('버킷 생성 완료');
      
      // 공개 읽기 권한 설정
      await bucket.makePublic();
      console.log('공개 읽기 권한 설정 완료');
    } else {
      console.log('버킷이 이미 존재합니다');
    }
    
    // 버킷 정보 확인
    const [metadata] = await bucket.getMetadata();
    console.log('버킷 정보:', {
      name: metadata.name,
      location: metadata.location,
      storageClass: metadata.storageClass
    });
    
    console.log('✅ GCS 버킷 테스트 완료');
    
  } catch (error) {
    console.error('❌ GCS 버킷 테스트 실패:', error);
  }
}

testGCSBucket();