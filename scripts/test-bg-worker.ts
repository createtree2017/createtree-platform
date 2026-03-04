import { fork } from 'child_process';
import path from 'path';
import sharp from 'sharp';

async function run() {
  try {
    console.log('🧪 Testing background removal worker...');
    
    // Create a dummy image
    const dummyImage = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 }
      }
    }).png().toBuffer();
    
    const requestBase64 = dummyImage.toString('base64');
    const workerPath = path.join(process.cwd(), 'server', 'workers', 'bg-removal.ts');
    
    console.log('🚀 Spawning worker:', workerPath);
    console.log('execArgv will be:', process.execArgv);
    
    const worker = fork(workerPath, {
      execArgv: process.execArgv
    });
    
    worker.on('message', (msg: any) => {
      console.log('📥 Received message from worker (type):', msg.type);
      if (msg.type === 'SUCCESS') {
        console.log('✅ SUCCESS! Result data length:', msg.resultData.length);
      } else {
        console.error('❌ ERROR!', msg.error);
      }
    });
    
    worker.on('error', (err) => {
      console.error('💥 Worker error:', err);
    });
    
    worker.on('exit', (code) => {
      console.log('👋 Worker exited with code', code);
    });
    
    console.log('📤 Sending message to worker...');
    worker.send({
      type: 'PROCESS_IMAGE',
      id: 'test_123',
      imageData: requestBase64
    });
    
  } catch (error) {
    console.error('💥 Test script error:', error);
  }
}

run();
