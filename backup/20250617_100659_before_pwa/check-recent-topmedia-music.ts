/**
 * 최근 TopMediai 음악의 외부 ID 확인
 */

import { db } from './db/index.js';
import { music } from './shared/schema.js';
import { desc, eq } from 'drizzle-orm';
import axios from 'axios';

const API_BASE_URL = 'https://api.topmediai.com';
const API_KEY = process.env.TOPMEDIA_API_KEY;

const axiosConfig = {
  headers: {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 10000
};

async function checkRecentTopMediaiMusic() {
  console.log('📊 최근 TopMediai 음악 확인 및 가사 추출 테스트');
  
  try {
    // 최근 TopMediai 음악 조회
    const recentMusic = await db.query.music.findMany({
      where: eq(music.engine, 'topmedia'),
      orderBy: desc(music.createdAt),
      limit: 10
    });
    
    console.log(`\n발견된 TopMediai 음악: ${recentMusic.length}개`);
    
    for (const [index, musicRecord] of recentMusic.entries()) {
      console.log(`\n${index + 1}. 음악 정보:`);
      console.log(`   ID: ${musicRecord.id}`);
      console.log(`   제목: ${musicRecord.title}`);
      console.log(`   외부ID: ${musicRecord.externalId}`);
      console.log(`   상태: ${musicRecord.status}`);
      console.log(`   가사: ${musicRecord.lyrics ? '있음' : '없음'}`);
      console.log(`   생성일: ${musicRecord.createdAt}`);
      
      // 완료된 음악이고 외부 ID가 있으면 가사 확인
      if (musicRecord.status === 'completed' && musicRecord.externalId) {
        console.log(`\n   🔍 외부 ID로 가사 확인 중: ${musicRecord.externalId}`);
        
        try {
          const response = await axios.get(
            `${API_BASE_URL}/v2/query?song_id=${musicRecord.externalId}`, 
            axiosConfig
          );
          
          const responseData = response.data;
          console.log(`   ✅ API 응답 받음 (${response.status})`);
          
          // 응답 구조 분석
          console.log(`   📋 최상위 필드: ${Object.keys(responseData).join(', ')}`);
          
          if (responseData.data && Array.isArray(responseData.data)) {
            console.log(`   📋 data 배열 길이: ${responseData.data.length}`);
            
            responseData.data.forEach((item: any, itemIndex: number) => {
              console.log(`   📋 data[${itemIndex}] 필드: ${Object.keys(item).join(', ')}`);
              
              // 가사 관련 필드 확인
              const lyricsFields = ['lyrics', 'lyric', 'text', 'content', 'prompt_text', 'description'];
              let foundLyrics = false;
              
              for (const field of lyricsFields) {
                if (item[field] && typeof item[field] === 'string' && item[field].length > 10) {
                  console.log(`   ✅ 가사 발견! 필드: ${field}`);
                  console.log(`   📝 가사 내용 (첫 100자): "${item[field].substring(0, 100)}..."`);
                  foundLyrics = true;
                  
                  // 데이터베이스에 가사가 없으면 업데이트
                  if (!musicRecord.lyrics) {
                    console.log(`   💾 데이터베이스에 가사 저장 중...`);
                    try {
                      await db.update(music)
                        .set({ lyrics: item[field] })
                        .where(eq(music.id, musicRecord.id));
                      console.log(`   ✅ 가사 저장 완료`);
                    } catch (dbError) {
                      console.log(`   ❌ 가사 저장 실패:`, dbError);
                    }
                  }
                  break;
                }
              }
              
              if (!foundLyrics) {
                console.log(`   ❌ data[${itemIndex}]에서 가사를 찾을 수 없음`);
              }
            });
          } else {
            console.log(`   ❌ data 배열이 없거나 비어있음`);
          }
          
          // 전체 응답을 로그로 출력 (디버깅용)
          console.log(`   🔍 전체 응답 (처음 500자): ${JSON.stringify(responseData).substring(0, 500)}...`);
          
        } catch (apiError: any) {
          console.log(`   ❌ API 호출 실패: ${apiError.response?.status || apiError.message}`);
          if (apiError.response?.data) {
            console.log(`   📋 에러 응답: ${JSON.stringify(apiError.response.data)}`);
          }
        }
      } else {
        console.log(`   ⏭️ 건너뜀 (상태: ${musicRecord.status}, 외부ID: ${musicRecord.externalId || '없음'})`);
      }
    }
    
    console.log('\n📊 요약:');
    console.log(`- 전체 TopMediai 음악: ${recentMusic.length}개`);
    console.log(`- 완료된 음악: ${recentMusic.filter(m => m.status === 'completed').length}개`);
    console.log(`- 가사가 있는 음악: ${recentMusic.filter(m => m.lyrics).length}개`);
    console.log(`- 외부 ID가 있는 음악: ${recentMusic.filter(m => m.externalId).length}개`);
    
  } catch (error) {
    console.error('❌ 실행 오류:', error);
  }
}

checkRecentTopMediaiMusic().catch(console.error);