/**
 * GCS 업로드 직접 테스트
 */
import { uploadToGCS } from '../../server/utils/gcs';

async function testGCSUpload() {
  console.log('🔄 GCS 업로드 직접 테스트 시작');
  
  // 실제 TopMediai URL로 테스트
  const testUrl = 'https://files.topmediai.com/aimusic/api/14933000/66544bba-0b17-4776-bc5c-97b73951079d-audio.mp3';
  const testPath = `music/test-${Date.now()}.mp3`;
  
  try {
    console.log('원본 URL:', testUrl);
    console.log('GCS 경로:', testPath);
    
    const gcsUrl = await uploadToGCS(testUrl, testPath);
    
    console.log('✅ GCS 업로드 성공:', gcsUrl);
    
  } catch (error) {
    console.error('❌ GCS 업로드 실패:', error.message);
    console.error('상세 오류:', error);
  }
}

testGCSUpload();