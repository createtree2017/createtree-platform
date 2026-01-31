import { db } from '../db/index.js';
import { images } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function checkImageCategory() {
    const imageId = 6546;

    console.log(`\n🔍 이미지 ID ${imageId} 정보 조회 중...\n`);

    const image = await db.query.images.findFirst({
        where: eq(images.id, imageId)
    });

    if (!image) {
        console.log(`❌ 이미지 ID ${imageId}를 찾을 수 없습니다.`);
        process.exit(1);
    }

    console.log('📊 이미지 정보:');
    console.log('================');
    console.log(`ID: ${image.id}`);
    console.log(`제목: ${image.title}`);
    console.log(`카테고리 ID: ${image.categoryId}`);
    console.log(`컨셉 ID: ${image.conceptId}`);
    console.log(`스타일: ${image.style || '없음'}`);
    console.log(`사용자 ID: ${image.userId}`);
    console.log(`생성 시간: ${image.createdAt}`);
    console.log('================\n');

    // 같은 사용자의 sticker_img 카테고리 이미지 수 확인
    const stickerImages = await db.query.images.findMany({
        where: eq(images.categoryId, 'sticker_img')
    });

    console.log(`✅ sticker_img 카테고리 이미지: 총 ${stickerImages.length}개`);
    console.log(`   (이미지 ${imageId} 포함 여부: ${stickerImages.some(img => img.id === imageId) ? '✅ 포함됨' : '❌ 없음'})\n`);

    process.exit(0);
}

checkImageCategory().catch(console.error);
