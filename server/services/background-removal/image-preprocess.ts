import sharp from 'sharp';

export async function convertToPng(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  console.log(
    `[Background Removal] Image format: ${metadata.format}, ${metadata.width}x${metadata.height}`
  );

  return sharp(imageBuffer)
    .png()
    .toBuffer();
}

export async function invertAlphaComposite(
  originalBuffer: Buffer,
  foregroundBuffer: Buffer
): Promise<Buffer> {
  const { data: fgData, info: fgInfo } = await sharp(foregroundBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const invertedAlpha = Buffer.alloc(fgInfo.width * fgInfo.height);
  for (let i = 0; i < invertedAlpha.length; i += 1) {
    const alphaValue = fgData[i * 4 + 3];
    invertedAlpha[i] = 255 - alphaValue;
  }

  const alphaMask = await sharp(invertedAlpha, {
    raw: { width: fgInfo.width, height: fgInfo.height, channels: 1 },
  })
    .png()
    .toBuffer();

  return sharp(originalBuffer)
    .resize(fgInfo.width, fgInfo.height)
    .ensureAlpha()
    .joinChannel(alphaMask)
    .png()
    .toBuffer();
}
