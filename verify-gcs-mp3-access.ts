/**
 * GCS .mp3 파일들의 실제 접근 가능성 검증
 */

async function verifyGCSMp3Access() {
  console.log('🔍 GCS .mp3 파일 접근성 검증 시작...');
  
  const candidateFiles = [
    'music/30.mp3',
    'music/90_1749835759314.mp3', 
    'music/e3a403be-f53e-42ed-ace1-716574ad8bff.mp3',
    'music/8e754aeb-eb7a-44d0-9e1b-bfbd1de9ebc0.mp3',
    'music/359dbe82-b125-406a-b8d4-7902f7c23456.mp3',
    'music/music_79_1749835759314.mp3',
    'music/music_80_1749835759314.mp3', 
    'music/music_81_1749881687782.mp3',
    'music/music_82_1749881687803.mp3',
    'music/music_27_1749881687760.mp3',
    'music/music_29_1749881687765.mp3',
    'music/music_31_1749881687770.mp3',
    'music/music_32_1749881687775.mp3',
    'music/music_34_1749881687780.mp3',
    'music/music_88_1749881687800.mp3',
    'music/music_89_1749881687801.mp3',
    'music/music_90_1749881687802.mp3'
  ];
  
  const accessibleFiles: string[] = [];
  const inaccessibleFiles: string[] = [];
  
  for (const file of candidateFiles) {
    const url = `https://storage.googleapis.com/createtree-upload/${file}`;
    
    try {
      const response = await fetch(url, { method: 'HEAD' });
      
      if (response.ok) {
        const size = response.headers.get('content-length');
        console.log(`✅ 접근 가능: ${file} (${Math.round(parseInt(size || '0') / 1024 / 1024 * 100) / 100}MB)`);
        accessibleFiles.push(file);
      } else {
        console.log(`❌ 접근 불가: ${file} (${response.status})`);
        inaccessibleFiles.push(file);
      }
    } catch (error) {
      console.log(`❌ 오류: ${file} - ${error.message}`);
      inaccessibleFiles.push(file);
    }
    
    // 요청 간격 조절
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📊 검증 결과:');
  console.log(`✅ 접근 가능한 파일: ${accessibleFiles.length}개`);
  console.log(`❌ 접근 불가능한 파일: ${inaccessibleFiles.length}개`);
  
  console.log('\n🎵 사용 가능한 음악 파일 목록:');
  accessibleFiles.forEach((file, index) => {
    const fullUrl = `https://storage.googleapis.com/createtree-upload/${file}`;
    console.log(`${index + 1}. ${file}`);
    console.log(`   URL: ${fullUrl}`);
  });
  
  return {
    accessible: accessibleFiles,
    inaccessible: inaccessibleFiles,
    total: candidateFiles.length
  };
}

verifyGCSMp3Access().catch(console.error);