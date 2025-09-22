/**
 * 음악 생성 상태 테스트 스크립트
 */

import { useMusicGenerationStore } from './client/src/stores/musicGenerationStore';

console.log('🎵 음악 상태 스토어 테스트 시작');

// 스토어 직접 접근
const store = useMusicGenerationStore.getState();
console.log('현재 상태:', store);

// 상태 변경 테스트
store.setGenerating(true);
console.log('true 설정 후:', useMusicGenerationStore.getState());

store.setGenerating(false);
console.log('false 설정 후:', useMusicGenerationStore.getState());