// 이미지 생성 상태 완전 정리 스크립트
console.log('🧹 이미지 생성 상태 완전 정리 시작');

// 모든 관련 localStorage 항목 삭제
const keysToRemove = [
  'pendingImageTasks',
  'imageGenerationState', 
  'backgroundTasks',
  'isTransforming',
  'transformedImages',
  'imageQueue',
  'processingImages',
  'generateStatus'
];

keysToRemove.forEach(key => {
  localStorage.removeItem(key);
  console.log(`✓ ${key} 삭제됨`);
});

// 이미지 관련 모든 키 찾아서 삭제
const imageKeys = Object.keys(localStorage).filter(key => 
  key.includes('image') || 
  key.includes('transform') || 
  key.includes('background') || 
  key.includes('pending')
);

imageKeys.forEach(key => {
  localStorage.removeItem(key);
  console.log(`✓ ${key} 삭제됨`);
});

// sessionStorage도 정리
keysToRemove.forEach(key => {
  sessionStorage.removeItem(key);
});

console.log('🧹 이미지 생성 상태 완전 정리 완료 - 페이지 새로고침을 권장합니다');
console.log('페이지 새로고침: location.reload()');

// 자동으로 새로고침
setTimeout(() => {
  console.log('페이지 자동 새로고침 중...');
  location.reload();
}, 1000);
