export { };
// Railway 디버그 래퍼 - 모듈 로딩 에러를 캡처
console.log('🔧 [WRAPPER] Starting error-catching wrapper...');
console.log('🔧 [WRAPPER] Node version:', process.version);
console.log('🔧 [WRAPPER] CWD:', process.cwd());
console.log('🔧 [WRAPPER] NODE_ENV:', process.env.NODE_ENV);
console.log('🔧 [WRAPPER] PORT:', process.env.PORT);

// 모든 종류의 에러를 캡처
process.on('uncaughtException', (err: Error) => {
    console.error('❌ [WRAPPER] UNCAUGHT EXCEPTION:', err.message);
    console.error('❌ [WRAPPER] Stack:', err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
    console.error('❌ [WRAPPER] UNHANDLED REJECTION:', reason);
    process.exit(1);
});

// 메인 서버 모듈을 동적 import로 로드 (에러 캡처 가능)
console.log('🔧 [WRAPPER] Loading main server module...');
try {
    await import('./index.js');
    console.log('✅ [WRAPPER] Main module loaded successfully');
} catch (err: any) {
    console.error('❌ [WRAPPER] MODULE LOAD ERROR:', err.message);
    console.error('❌ [WRAPPER] Error name:', err.constructor?.name);
    console.error('❌ [WRAPPER] Stack:', err.stack);

    // 모듈을 찾을 수 없는 경우
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
        console.error('❌ [WRAPPER] Missing module! Likely a devDependency not installed in production.');
        console.error('❌ [WRAPPER] Specifier:', err.url || 'unknown');
    }

    process.exit(1);
}
