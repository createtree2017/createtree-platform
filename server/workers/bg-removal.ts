import { removeBackground } from '@imgly/background-removal-node';
import { Blob } from 'buffer';

console.log('✅ [Worker] Background removal worker started. PID:', process.pid);

process.on('message', async (message: { type: string, imageData: string, id: string }) => {
  if (message.type === 'PROCESS_IMAGE') {
    try {
      console.log(`🎯 [Worker] Received request ${message.id}, decoding base64...`);
      const pngBuffer = Buffer.from(message.imageData, 'base64');
      const inputBlob = new Blob([pngBuffer], { type: 'image/png' }) as any;

      console.log(`📐 [Worker] Starting @imgly background removal for request ${message.id}...`);
      const blob = await removeBackground(inputBlob, {
        model: 'medium',
        output: {
          format: 'image/png',
          quality: 1.0,
        },
      });

      console.log(`✅ [Worker] Background removal completed for request ${message.id}. Encoding result...`);
      const resultBuffer = Buffer.from(await blob.arrayBuffer());
      const resultBase64 = resultBuffer.toString('base64');

      if (process.send) {
        process.send({
          type: 'SUCCESS',
          id: message.id,
          resultData: resultBase64
        });
      }
      
      // 워커는 1회용으로 동작 후 안전하게 종료 (메모리 정리 목적)
      setTimeout(() => process.exit(0), 100);
      
    } catch (error) {
      console.error(`❌ [Worker] Error processing request ${message.id}:`, error);
      if (process.send) {
        process.send({
          type: 'ERROR',
          id: message.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // 에러 시에도 워커 종료
      setTimeout(() => process.exit(1), 100);
    }
  }
});
