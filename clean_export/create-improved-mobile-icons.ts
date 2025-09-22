/**
 * 모바일 환경에서 더 명확하고 인식하기 쉬운 PWA 아이콘 생성
 * 의료진 십자가 + AI 신경망을 조합한 현대적 디자인
 */

import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

// SVG 기반 아이콘 생성 함수 (의료 + AI 테마)
function generateMedicalAIIcon(size: number): string {
  const centerX = size / 2;
  const centerY = size / 2;
  const crossSize = size * 0.35; // 십자가 크기
  const crossThickness = size * 0.08; // 십자가 두께
  const aiNodeSize = size * 0.04; // AI 노드 크기
  
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- 그라데이션 정의 -->
    <radialGradient id="bgGradient" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#8B5CF6" />
      <stop offset="50%" stop-color="#7C3AED" />
      <stop offset="100%" stop-color="#5B21B6" />
    </radialGradient>
    
    <linearGradient id="crossGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#F1F5F9" />
    </linearGradient>
    
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge> 
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- 배경 원 -->
  <circle cx="${centerX}" cy="${centerY}" r="${size * 0.45}" fill="url(#bgGradient)" stroke="#4C1D95" stroke-width="${size * 0.02}"/>
  
  <!-- 의료진 십자가 -->
  <g filter="url(#glow)">
    <!-- 세로 막대 -->
    <rect x="${centerX - crossThickness/2}" y="${centerY - crossSize/2}" 
          width="${crossThickness}" height="${crossSize}" 
          fill="url(#crossGradient)" rx="${crossThickness * 0.2}"/>
    <!-- 가로 막대 -->
    <rect x="${centerX - crossSize/2}" y="${centerY - crossThickness/2}" 
          width="${crossSize}" height="${crossThickness}" 
          fill="url(#crossGradient)" rx="${crossThickness * 0.2}"/>
  </g>
  
  <!-- AI 신경망 노드들 -->
  <g opacity="0.8">
    <!-- 상단 좌측 노드 -->
    <circle cx="${centerX - size * 0.25}" cy="${centerY - size * 0.25}" r="${aiNodeSize}" fill="#60A5FA" opacity="0.9"/>
    <!-- 상단 우측 노드 -->
    <circle cx="${centerX + size * 0.25}" cy="${centerY - size * 0.25}" r="${aiNodeSize}" fill="#34D399" opacity="0.9"/>
    <!-- 하단 좌측 노드 -->
    <circle cx="${centerX - size * 0.25}" cy="${centerY + size * 0.25}" r="${aiNodeSize}" fill="#F59E0B" opacity="0.9"/>
    <!-- 하단 우측 노드 -->
    <circle cx="${centerX + size * 0.25}" cy="${centerY + size * 0.25}" r="${aiNodeSize}" fill="#EF4444" opacity="0.9"/>
    
    <!-- 연결선들 -->
    <g stroke="#E2E8F0" stroke-width="${size * 0.008}" opacity="0.6">
      <line x1="${centerX - size * 0.25}" y1="${centerY - size * 0.25}" x2="${centerX}" y2="${centerY}"/>
      <line x1="${centerX + size * 0.25}" y1="${centerY - size * 0.25}" x2="${centerX}" y2="${centerY}"/>
      <line x1="${centerX - size * 0.25}" y1="${centerY + size * 0.25}" x2="${centerX}" y2="${centerY}"/>
      <line x1="${centerX + size * 0.25}" y1="${centerY + size * 0.25}" x2="${centerX}" y2="${centerY}"/>
    </g>
  </g>
  
  <!-- 하단에 작은 "AI" 텍스트 -->
  <text x="${centerX}" y="${centerY + size * 0.35}" 
        text-anchor="middle" 
        fill="white" 
        font-family="Arial, sans-serif" 
        font-weight="bold" 
        font-size="${size * 0.12}"
        opacity="0.9">AI</text>
</svg>`;
}

// PNG 변환을 위한 간단한 SVG (Sharp 라이브러리 사용)
async function createPNGFromSVG(svgContent: string, outputPath: string, size: number) {
  try {
    const sharp = require('sharp');
    
    const svgBuffer = Buffer.from(svgContent);
    
    await sharp(svgBuffer)
      .resize(size, size)
      .png({ quality: 100, compressionLevel: 0 })
      .toFile(outputPath);
      
    console.log(`✅ PNG 아이콘 생성 완료: ${outputPath} (${size}x${size})`);
  } catch (error) {
    console.error(`❌ PNG 생성 실패 ${outputPath}:`, error);
    
    // Sharp가 없는 경우 SVG로 대체
    const svgPath = outputPath.replace('.png', '.svg');
    writeFileSync(svgPath, svgContent, 'utf8');
    console.log(`📁 SVG 대체 파일 생성: ${svgPath}`);
  }
}

async function createImprovedMobileIcons() {
  console.log('🎨 모바일 친화적 PWA 아이콘 생성 시작...');
  
  // 아이콘 디렉토리 생성
  const iconsDir = path.join(process.cwd(), 'client/public/icons');
  try {
    mkdirSync(iconsDir, { recursive: true });
  } catch (error) {
    // 디렉토리가 이미 존재하는 경우 무시
  }
  
  // 생성할 아이콘 크기들
  const iconSizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];
  
  for (const size of iconSizes) {
    const svgContent = generateMedicalAIIcon(size);
    const pngPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    
    await createPNGFromSVG(svgContent, pngPath, size);
  }
  
  // Favicon 파일들도 업데이트
  const favicon16 = generateMedicalAIIcon(16);
  const favicon32 = generateMedicalAIIcon(32);
  
  const publicDir = path.join(process.cwd(), 'client/public');
  
  // Favicon PNG 파일들 생성
  await createPNGFromSVG(favicon16, path.join(publicDir, 'favicon-16x16.png'), 16);
  await createPNGFromSVG(favicon32, path.join(publicDir, 'favicon-32x32.png'), 32);
  
  // 메인 로고도 업데이트 (512x512)
  const logoSvg = generateMedicalAIIcon(512);
  await createPNGFromSVG(logoSvg, path.join(publicDir, 'logo.png'), 512);
  
  // SVG 로고도 생성
  writeFileSync(path.join(publicDir, 'logo.svg'), logoSvg, 'utf8');
  writeFileSync(path.join(publicDir, 'favicon.svg'), generateMedicalAIIcon(32), 'utf8');
  
  console.log('🎯 PWA 아이콘 시스템 개선 완료!');
  console.log('📱 모바일에서 더 명확하게 식별 가능한 의료 + AI 디자인 적용');
  console.log('✨ 특징:');
  console.log('   - 의료진 십자가 중앙 배치');
  console.log('   - AI 신경망 노드 4개 모서리 배치');
  console.log('   - 보라색 그라데이션 배경으로 브랜딩 강화');
  console.log('   - 모든 크기에서 선명한 가독성 확보');
}

// 실행
createImprovedMobileIcons().catch(console.error);