/**
 * 실제 작동하는 GCS 설정 확인 및 정리
 */

import { Storage } from '@google-cloud/storage';

async function identifyWorkingGCSConfig() {
  console.log('🔍 GCS 설정 분석 시작...\n');

  // 설정 1: 환경변수 기반 설정 (gcs-image-storage.ts)
  console.log('1️⃣ 환경변수 기반 설정 테스트');
  console.log(`PROJECT_ID: ${process.env.GOOGLE_CLOUD_PROJECT_ID}`);
  console.log(`CLIENT_EMAIL: ${process.env.GOOGLE_CLOUD_CLIENT_EMAIL}`);
  console.log(`PRIVATE_KEY 길이: ${process.env.GOOGLE_CLOUD_PRIVATE_KEY?.length} 문자`);

  try {
    const storage1 = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n')
      }
    });

    const bucket1 = storage1.bucket('createtree-upload');
    const [exists1] = await bucket1.exists();
    console.log(`   환경변수 설정 결과: ${exists1 ? '✅ 성공' : '❌ 실패'}`);

    if (exists1) {
      const [files1] = await bucket1.getFiles({ maxResults: 3 });
      console.log(`   파일 접근: ${files1.length}개 파일 발견`);
    }
  } catch (error) {
    console.log(`   환경변수 설정 오류: ${error}`);
  }

  console.log('\n2️⃣ 하드코딩된 설정 테스트 (gcs.ts)');
  
  // 설정 2: 하드코딩된 설정 (gcs.ts)
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

  try {
    const storage2 = new Storage({
      projectId: 'createtreeai',
      credentials: serviceAccountKey
    });

    const bucket2 = storage2.bucket('createtree-upload');
    const [exists2] = await bucket2.exists();
    console.log(`   하드코딩 설정 결과: ${exists2 ? '✅ 성공' : '❌ 실패'}`);

    if (exists2) {
      const [files2] = await bucket2.getFiles({ maxResults: 3 });
      console.log(`   파일 접근: ${files2.length}개 파일 발견`);
      
      // 마이그레이션 테스트
      console.log('\n3️⃣ 마이그레이션 권한 테스트');
      const testFile = `test-migration-${Date.now()}.txt`;
      const testCopy = `test-copy-${Date.now()}.txt`;
      
      try {
        // 파일 생성
        await bucket2.file(testFile).save('test content');
        console.log(`   ✅ 파일 생성 성공`);
        
        // 파일 복사
        await bucket2.file(testFile).copy(bucket2.file(testCopy));
        console.log(`   ✅ 파일 복사 성공`);
        
        // 권한 설정
        await bucket2.file(testCopy).makePublic();
        console.log(`   ✅ 공개 권한 설정 성공`);
        
        // 정리
        await bucket2.file(testFile).delete();
        await bucket2.file(testCopy).delete();
        console.log(`   ✅ 파일 정리 완료`);
        
        console.log('\n🎯 결론: 하드코딩된 설정이 완전히 작동합니다!');
        console.log('📋 마이그레이션 가능 작업:');
        console.log('   • 파일 읽기/쓰기');
        console.log('   • 파일 복사');
        console.log('   • 권한 설정');
        console.log('   • 파일 삭제');
        
      } catch (migrationError) {
        console.log(`   ❌ 마이그레이션 테스트 실패: ${migrationError}`);
      }
    }
  } catch (error) {
    console.log(`   하드코딩 설정 오류: ${error}`);
  }
}

identifyWorkingGCSConfig().catch(console.error);