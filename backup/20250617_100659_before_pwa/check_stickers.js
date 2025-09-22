
const { Storage } = require('./server/storage');
const storage = new Storage();

async function checkStickerImages() {
  try {
    const result = await storage.getPaginatedImageList(1, 100, null, null);
    console.log('=== 전체 이미지 검색 ===');
    
    const allImages = result.images;
    console.log(`전체 이미지: ${allImages.length}개`);
    
    // diz 스타일 검색
    const dizImages = allImages.filter(img => 
      img.title.includes('diz') || img.style.includes('diz')
    );
    console.log(`\ndiz 스타일 이미지: ${dizImages.length}개`);
    
    // sticker 키워드 검색
    const stickerImages = allImages.filter(img => 
      img.title.includes('sticker') || img.style.includes('sticker')
    );
    console.log(`sticker 키워드 이미지: ${stickerImages.length}개`);
    
    // 메타데이터에서 categoryId가 sticker_img인 이미지 검색
    const stickerCategoryImages = allImages.filter(img => {
      if (img.metadata) {
        try {
          const meta = typeof img.metadata === 'string' ? JSON.parse(img.metadata) : img.metadata;
          return meta.categoryId === 'sticker_img';
        } catch (e) {
          return false;
        }
      }
      return false;
    });
    console.log(`\nsticker_img 카테고리 이미지: ${stickerCategoryImages.length}개`);
    
    // 샘플 이미지 출력
    console.log('\n=== 샘플 이미지 (최근 5개) ===');
    allImages.slice(0, 5).forEach(img => {
      console.log(`ID: ${img.id}, 제목: ${img.title}, 스타일: ${img.style}`);
    });
    
  } catch (error) {
    console.error('검색 오류:', error);
  }
  process.exit(0);
}

checkStickerImages();

