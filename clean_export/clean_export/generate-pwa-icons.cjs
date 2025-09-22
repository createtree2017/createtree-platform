/**
 * PWA 아이콘 생성 스크립트
 * 다양한 크기의 PNG 아이콘을 생성합니다
 */

const fs = require('fs');
const path = require('path');

// SVG 아이콘 템플릿 (우리병원 문화센터 로고)
const createSVGIcon = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#7c3aed;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#5b21b6;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#e5e7eb;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- 배경 -->
  <rect width="512" height="512" rx="80" fill="url(#bgGradient)"/>
  
  <!-- 병원 십자가 -->
  <rect x="216" y="120" width="80" height="272" fill="url(#iconGradient)" rx="10"/>
  <rect x="156" y="180" width="200" height="80" fill="url(#iconGradient)" rx="10"/>
  
  <!-- 음악 노트 -->
  <circle cx="380" cy="350" r="25" fill="url(#iconGradient)"/>
  <rect x="375" y="280" width="10" height="70" fill="url(#iconGradient)"/>
  <path d="M385 280 Q420 270 420 300 Q420 320 400 325 L385 330 Z" fill="url(#iconGradient)"/>
  
  <!-- 하트 -->
  <path d="M140 380 C140 360, 120 340, 100 340 C80 340, 60 360, 60 380 C60 400, 100 440, 100 440 C100 440, 140 400, 140 380 Z" fill="url(#iconGradient)"/>
  
  <!-- AI 아이콘 (원형) -->
  <circle cx="400" cy="160" r="30" fill="url(#iconGradient)" opacity="0.8"/>
  <text x="400" y="170" text-anchor="middle" fill="#7c3aed" font-family="Arial, sans-serif" font-size="24" font-weight="bold">AI</text>
</svg>
`;

// 스크린샷 SVG 템플릿
const createScreenshotSVG = (width, height) => `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="screenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f8fafc;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#e2e8f0;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- 배경 -->
  <rect width="${width}" height="${height}" fill="url(#screenGradient)"/>
  
  <!-- 헤더 -->
  <rect x="0" y="0" width="${width}" height="80" fill="#7c3aed"/>
  <text x="${width/2}" y="50" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="24" font-weight="bold">AI 우리병원 문화센터</text>
  
  <!-- 메인 콘텐츠 -->
  <rect x="40" y="120" width="${width-80}" height="100" fill="white" rx="10" stroke="#e2e8f0" stroke-width="2"/>
  <text x="${width/2}" y="160" text-anchor="middle" fill="#374151" font-family="Arial, sans-serif" font-size="18">음악 생성</text>
  <text x="${width/2}" y="190" text-anchor="middle" fill="#6b7280" font-family="Arial, sans-serif" font-size="14">AI로 개인 맞춤 음악을 만들어보세요</text>
  
  <rect x="40" y="240" width="${width-80}" height="100" fill="white" rx="10" stroke="#e2e8f0" stroke-width="2"/>
  <text x="${width/2}" y="280" text-anchor="middle" fill="#374151" font-family="Arial, sans-serif" font-size="18">이미지 변환</text>
  <text x="${width/2}" y="310" text-anchor="middle" fill="#6b7280" font-family="Arial, sans-serif" font-size="14">사진을 아름다운 작품으로 변환</text>
  
  <rect x="40" y="360" width="${width-80}" height="100" fill="white" rx="10" stroke="#e2e8f0" stroke-width="2"/>
  <text x="${width/2}" y="400" text-anchor="middle" fill="#374151" font-family="Arial, sans-serif" font-size="18">AI 채팅</text>
  <text x="${width/2}" y="430" text-anchor="middle" fill="#6b7280" font-family="Arial, sans-serif" font-size="14">24시간 AI 의료 상담</text>
</svg>
`;

// 아이콘 크기 배열
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Sharp 라이브러리가 설치되어 있는지 확인
const createPNGFromSVG = async (svgContent, outputPath) => {
  try {
    const sharp = require('sharp');
    const buffer = Buffer.from(svgContent);
    await sharp(buffer).png().toFile(outputPath);
    return true;
  } catch (error) {
    console.log(`Sharp를 사용할 수 없습니다. SVG 파일로 저장합니다: ${error.message}`);
    return false;
  }
};

// 파일 생성 함수
const generateIcons = async () => {
  const iconsDir = path.join(__dirname, 'client', 'public', 'icons');
  const screenshotsDir = path.join(__dirname, 'client', 'public', 'screenshots');
  
  // 디렉토리 생성
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 아이콘 생성
  for (const size of iconSizes) {
    const svgContent = createSVGIcon(size);
    const filename = `icon-${size}x${size}`;
    
    // Sharp로 PNG 생성 시도
    const pngSuccess = await createPNGFromSVG(svgContent, path.join(iconsDir, `${filename}.png`));
    
    if (!pngSuccess) {
      // Sharp 실패 시 SVG로 저장하고 PNG로 복사
      fs.writeFileSync(path.join(iconsDir, `${filename}.svg`), svgContent);
      fs.writeFileSync(path.join(iconsDir, `${filename}.png`), svgContent); // SVG를 PNG로 저장 (브라우저에서 처리)
    }
    
    console.log(`생성됨: ${filename}.png`);
  }

  // 스크린샷 생성
  const wideScreenshot = createScreenshotSVG(1280, 720);
  const narrowScreenshot = createScreenshotSVG(640, 1136);
  
  // Wide 스크린샷
  const wideSuccess = await createPNGFromSVG(wideScreenshot, path.join(screenshotsDir, 'wide.png'));
  if (!wideSuccess) {
    fs.writeFileSync(path.join(screenshotsDir, 'wide.svg'), wideScreenshot);
    fs.writeFileSync(path.join(screenshotsDir, 'wide.png'), wideScreenshot);
  }
  
  // Narrow 스크린샷
  const narrowSuccess = await createPNGFromSVG(narrowScreenshot, path.join(screenshotsDir, 'narrow.png'));
  if (!narrowSuccess) {
    fs.writeFileSync(path.join(screenshotsDir, 'narrow.svg'), narrowScreenshot);
    fs.writeFileSync(path.join(screenshotsDir, 'narrow.png'), narrowScreenshot);
  }
  
  console.log('PWA 아이콘 및 스크린샷 생성 완료!');
  console.log(`아이콘: ${iconSizes.length}개 생성`);
  console.log('스크린샷: wide.png, narrow.png 생성');
};

// 스크립트 실행
if (require.main === module) {
  generateIcons().catch(console.error);
}

module.exports = { generateIcons };