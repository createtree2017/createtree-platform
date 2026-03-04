import { removeBackground } from '@imgly/background-removal-node';
import fs from 'fs';
import path from 'path';

async function test() {
  console.log('Starting test...');
  try {
    // Read a dummy image from static (like banner or something small)
    // Create a 10x10 png locally to test
    const sharp = (await import('sharp')).default;
    const dummyImageBuffer = await sharp({
      create: {
        width: 100, height: 100, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 }
      }
    }).png().toBuffer();

    console.log('Dummy image created, size:', dummyImageBuffer.length);
    
    // Instead of Blob (which might cause issues), we can pass the Buffer directly?
    // Let's pass what the current code passes: a Blob
    const inputBlob = new Blob([dummyImageBuffer], { type: 'image/png' }) as any;
    
    console.log('Calling removeBackground...');
    const resultBlob = await removeBackground(inputBlob, {
      model: 'medium',
      output: { format: 'image/png', quality: 1.0 }
    });
    
    console.log('Success! Result blob size:', resultBlob.size);
  } catch (err) {
    console.error('Error caught in test script:', err);
  }
}

test();
