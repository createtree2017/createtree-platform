/**
 * PWA 아이콘 생성 스크립트
 * 첨부된 레퍼런스 이미지와 유사한 스타일로 병원 문화센터 아이콘 생성
 */

import fs from 'fs';
import path from 'path';

// SVG 아이콘 템플릿 (레퍼런스 이미지와 유사한 스타일)
function generateSVGIcon(size: number): string {
  const padding = size * 0.1; // 10% 패딩
  const contentSize = size - (padding * 2);
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- 배경 원형 -->
  <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#f8fafc"/>
  
  <!-- 메인 그라데이션 배경 -->
  <defs>
    <linearGradient id="mainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#7c3aed;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#f59e0b;stop-opacity:1" />
    </linearGradient>
    
    <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#ef4444;stop-opacity:1" />
    </linearGradient>
    
    <radialGradient id="highlightGradient" cx="30%" cy="30%">
      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.3" />
      <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0" />
    </radialGradient>
  </defs>
  
  <!-- 메인 'C' 형태 (병원의 Care를 의미) -->
  <g transform="translate(${padding}, ${padding})">
    <!-- C 형태의 메인 도형 -->
    <path d="M ${contentSize * 0.7} ${contentSize * 0.15} 
             A ${contentSize * 0.35} ${contentSize * 0.35} 0 1 0 ${contentSize * 0.7} ${contentSize * 0.85}
             L ${contentSize * 0.55} ${contentSize * 0.75}
             A ${contentSize * 0.2} ${contentSize * 0.2} 0 1 1 ${contentSize * 0.55} ${contentSize * 0.25}
             Z" 
          fill="url(#mainGradient)" 
          stroke="none"/>
    
    <!-- 작은 원형 포인트 (AI를 의미) -->
    <circle cx="${contentSize * 0.8}" cy="${contentSize * 0.3}" r="${contentSize * 0.08}" fill="url(#accentGradient)"/>
    
    <!-- 세로 바 (Innovation/Intelligence를 의미) -->
    <rect x="${contentSize * 0.85}" y="${contentSize * 0.2}" 
          width="${contentSize * 0.12}" height="${contentSize * 0.6}" 
          rx="${contentSize * 0.06}" 
          fill="url(#mainGradient)"/>
    
    <!-- 하이라이트 효과 -->
    <ellipse cx="${contentSize * 0.4}" cy="${contentSize * 0.3}" 
             rx="${contentSize * 0.25}" ry="${contentSize * 0.2}" 
             fill="url(#highlightGradient)"/>
  </g>
  
  <!-- 외곽 그림자 효과 -->
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" 
          fill="none" 
          stroke="rgba(59, 130, 246, 0.2)" 
          stroke-width="2"/>
</svg>`;
}

// 개선된 PWA 아이콘 (레퍼런스 이미지 스타일 반영)
function generateSimpleSVGIcon(size: number): string {
  const padding = size * 0.1;
  const contentSize = size - (padding * 2);
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e293b"/>
      <stop offset="100%" style="stop-color:#475569"/>
    </linearGradient>
    <linearGradient id="cGrad${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0ea5e9"/>
      <stop offset="50%" style="stop-color:#3b82f6"/>
      <stop offset="100%" style="stop-color:#6366f1"/>
    </linearGradient>
    <linearGradient id="iGrad${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f8fafc"/>
      <stop offset="100%" style="stop-color:#e2e8f0"/>
    </linearGradient>
    <linearGradient id="dotGrad${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#fbbf24"/>
      <stop offset="100%" style="stop-color:#f59e0b"/>
    </linearGradient>
  </defs>
  
  <!-- 배경 -->
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bgGrad${size})"/>
  
  <!-- 메인 컨텐츠 -->
  <g transform="translate(${padding}, ${padding})">
    <!-- 'C' 형태 (Care, Center를 의미) -->
    <path d="M ${contentSize * 0.68} ${contentSize * 0.18} 
             A ${contentSize * 0.32} ${contentSize * 0.32} 0 1 0 ${contentSize * 0.68} ${contentSize * 0.82}
             L ${contentSize * 0.52} ${contentSize * 0.72}
             A ${contentSize * 0.16} ${contentSize * 0.16} 0 1 1 ${contentSize * 0.52} ${contentSize * 0.28}
             Z" 
          fill="url(#cGrad${size})" stroke="none"/>
    
    <!-- 'i' 형태 세로 바 (Intelligence, Innovation을 의미) -->
    <rect x="${contentSize * 0.78}" y="${contentSize * 0.28}" 
          width="${contentSize * 0.12}" height="${contentSize * 0.54}" 
          rx="${contentSize * 0.06}" 
          fill="url(#iGrad${size})"/>
    
    <!-- 'i' 점 (AI의 핵심을 의미) -->
    <circle cx="${contentSize * 0.84}" cy="${contentSize * 0.15}" 
            r="${contentSize * 0.065}" 
            fill="url(#dotGrad${size})"/>
  </g>
  
  <!-- 미묘한 하이라이트 -->
  <ellipse cx="${size * 0.35}" cy="${size * 0.25}" 
           rx="${size * 0.15}" ry="${size * 0.08}" 
           fill="rgba(255,255,255,0.1)"/>
</svg>`;
}

// 아이콘 크기 배열 (작은 사이즈 추가)
const iconSizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];

async function createPWAIcons() {
  console.log('🎨 PWA 아이콘 생성 시작...');
  
  // icons 디렉토리 생성
  const iconsDir = path.join(process.cwd(), 'client/public/icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  
  // 각 크기별 SVG 아이콘 생성
  for (const size of iconSizes) {
    const svgContent = generateSimpleSVGIcon(size);
    const svgPath = path.join(iconsDir, `icon-${size}x${size}.svg`);
    
    fs.writeFileSync(svgPath, svgContent);
    console.log(`✅ SVG 아이콘 생성: ${size}x${size}`);
    
    // PNG 파일도 SVG로 대체 (최신 브라우저에서 SVG 지원)
    const pngPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    if (fs.existsSync(pngPath)) {
      // 기존 PNG 파일을 SVG로 교체하지 않고 유지
      console.log(`📁 기존 PNG 유지: ${size}x${size}`);
    }
  }
  
  // 고품질 SVG 아이콘 생성 (매니페스트용)
  const mainIconSvg = generateSVGIcon(512);
  const mainIconPath = path.join(iconsDir, 'icon-main.svg');
  fs.writeFileSync(mainIconPath, mainIconSvg);
  console.log('✅ 메인 SVG 아이콘 생성');
  
  // favicon.ico를 위한 작은 SVG
  const faviconSvg = generateSimpleSVGIcon(32);
  const faviconPath = path.join(process.cwd(), 'client/public/favicon.svg');
  fs.writeFileSync(faviconPath, faviconSvg);
  console.log('✅ Favicon SVG 생성');
  
  console.log('\n🎉 PWA 아이콘 생성 완료!');
  console.log(`📁 생성된 파일: ${iconsDir}`);
  console.log('🔧 매니페스트가 자동으로 새 아이콘들을 인식합니다.');
}

// 스크립트 실행
createPWAIcons()
  .then(() => {
    console.log('\n✅ PWA 아이콘 생성 성공');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ PWA 아이콘 생성 실패:', error);
    process.exit(1);
  });

export { createPWAIcons };