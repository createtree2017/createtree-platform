/**
 * GCS 버킷 직접 확인 - 구글 클라우드 API 사용
 */
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function checkGCSBucket() {
  console.log('=== GCS 버킷 직접 확인 ===');
  
  try {
    // gsutil 명령어로 버킷 내용 확인
    const { stdout, stderr } = await execAsync('gsutil ls gs://createtree-music/music/ 2>/dev/null || echo "버킷 접근 실패"');
    
    if (stdout.includes('버킷 접근 실패')) {
      console.log('❌ GCS 버킷 접근 실패 - gsutil 인증 필요');
      
      // curl로 공개 접근 가능한 파일 확인
      console.log('\n🔍 공개 접근 가능한 파일 확인...');
      
      const testUrls = [
        'https://storage.googleapis.com/createtree-music/music/test.mp3',
        'https://storage.googleapis.com/createtree-music/music/',
        'https://storage.googleapis.com/createtree-music/'
      ];
      
      for (const url of testUrls) {
        try {
          const { stdout: curlOut } = await execAsync(`curl -s -I "${url}" | head -1`);
          console.log(`${url}: ${curlOut.trim()}`);
        } catch (error) {
          console.log(`${url}: 요청 실패`);
        }
      }
      
    } else {
      console.log('✅ GCS 버킷 내용:');
      console.log(stdout);
      
      // 파일 개수 계산
      const files = stdout.trim().split('\n').filter(line => line && !line.endsWith('/'));
      console.log(`📁 총 ${files.length}개의 음악 파일 발견`);
    }
    
  } catch (error) {
    console.error('❌ GCS 확인 중 오류:', error.message);
  }
}

checkGCSBucket();