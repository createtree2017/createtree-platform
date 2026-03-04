import sharp from 'sharp';
import { removeBackground } from '@imgly/background-removal-node';

async function test() {
  console.log('Starting test2...');
  try {
    const pngBuffer = await sharp({ 
      create: { width: 10, height: 10, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } 
    }).png().toBuffer();
    
    console.log('Sharp created buffer');
    const inputBlob = new Blob([pngBuffer], { type: 'image/png' }) as any;
    
    console.log('Calling removeBackground...');
    // Provide minimal config or test if default download fails and crashes exactly like the server
    const blob = await removeBackground(inputBlob, {
      model: 'medium',
      output: { format: 'image/png', quality: 1.0 }
    });
    
    console.log('Success! Result blob size:', blob.size);
  } catch (err) {
    console.error('Error caught in test script:', err);
  }
}

test();
