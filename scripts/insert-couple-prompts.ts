import { db } from '../db';
import { snapshotPrompts } from '../shared/schema';
import fs from 'fs';
import path from 'path';

interface PromptData {
  category: string;
  type: string;
  gender: string;
  text: string;
}

async function insertCouplePrompts() {
  console.log('🚀 Starting couple prompts insertion...');
  
  try {
    // Read the file
    const filePath = path.join(process.cwd(), 'attached_assets', 'Pasted-import-type-Prompt-from-types-Note-The-prompts-below-assume-various-couple-compositi-1761886300468_1761886300469.txt');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    // Use regex to extract all prompt objects
    const prompts: PromptData[] = [];
    
    // Match each complete prompt object using regex
    const promptRegex = /\{\s*category:\s*['"](\w+)['"]\s*,\s*type:\s*['"]couple['"]\s*,\s*gender:\s*['"]unisex['"]\s*,\s*text:\s*"(Preserve the exact facial features[^"]+)"\s*,?\s*\}/gs;
    
    let match;
    while ((match = promptRegex.exec(fileContent)) !== null) {
      const category = match[1]; // daily, travel, or film
      const text = match[2]; // The full prompt text
      
      prompts.push({
        category,
        type: 'couple',
        gender: 'unisex',
        text
      });
    }
    
    console.log(`📝 Parsed ${prompts.length} prompts from file`);
    
    // Validate prompts
    const validPrompts = prompts.filter(p => 
      p.category && 
      p.type === 'couple' && 
      p.gender === 'unisex' && 
      p.text && 
      p.text.includes('Preserve the exact facial features')
    );
    
    console.log(`✅ ${validPrompts.length} valid prompts ready for insertion`);
    
    // Count by category
    const dailyCount = validPrompts.filter(p => p.category === 'daily').length;
    const travelCount = validPrompts.filter(p => p.category === 'travel').length;
    const filmCount = validPrompts.filter(p => p.category === 'film').length;
    
    console.log(`📊 Distribution:`);
    console.log(`   - Daily: ${dailyCount}`);
    console.log(`   - Travel: ${travelCount}`);
    console.log(`   - Film: ${filmCount}`);
    
    if (validPrompts.length !== 105) {
      console.warn(`⚠️  Warning: Expected 105 prompts, got ${validPrompts.length}`);
      console.log('\nFirst prompt sample:');
      console.log(JSON.stringify(validPrompts[0], null, 2));
    }
    
    // Check if couple prompts already exist (category='couple')
    const existingCouplePrompts = await db.query.snapshotPrompts.findMany({
      where: (prompts, { eq }) => eq(prompts.category, 'couple')
    });
    
    if (existingCouplePrompts.length > 0) {
      console.log(`⚠️  Found ${existingCouplePrompts.length} existing couple prompts in database`);
      console.log('❌ Aborting to prevent duplicates');
      return;
    }
    
    console.log('✅ No existing couple prompts found. Safe to proceed.');
    
    // Insert prompts in batches
    const batchSize = 20;
    let inserted = 0;
    let globalOrder = 0; // Global counter for order field
    
    for (let i = 0; i < validPrompts.length; i += batchSize) {
      const batch = validPrompts.slice(i, i + batchSize);
      
      const values = batch.map(p => ({
        category: 'couple' as const, // category is the persona (couple)
        type: p.category as 'daily' | 'travel' | 'film', // type is the style (daily/travel/film)
        gender: null, // Couple prompts don't need gender
        prompt: p.text,
        isActive: true,
        usageCount: 0,
        order: globalOrder++
      }));
      
      await db.insert(snapshotPrompts).values(values);
      inserted += batch.length;
      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}: ${inserted}/${validPrompts.length} prompts`);
    }
    
    console.log(`\n✅ Successfully inserted ${inserted} couple prompts!`);
    
    // Verify insertion
    const finalCount = await db.query.snapshotPrompts.findMany({
      where: (prompts, { eq }) => eq(prompts.category, 'couple')
    });
    
    console.log(`\n🎉 Final verification: ${finalCount.length} couple prompts in database`);
    
    // Count by type (correct field for this pattern)
    const dailyInDb = finalCount.filter(p => p.type === 'daily').length;
    const travelInDb = finalCount.filter(p => p.type === 'travel').length;
    const filmInDb = finalCount.filter(p => p.type === 'film').length;
    
    console.log(`📊 Final distribution:`);
    console.log(`   - Daily: ${dailyInDb}`);
    console.log(`   - Travel: ${travelInDb}`);
    console.log(`   - Film: ${filmInDb}`);
    
  } catch (error) {
    console.error('❌ Error inserting couple prompts:', error);
    throw error;
  }
}

// Run the script
insertCouplePrompts()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
