import { db } from '../db';
import { snapshotPrompts } from '../shared/schema';
import fs from 'fs';
import path from 'path';

interface ParsedPrompt {
  category: 'daily' | 'travel' | 'film'; // In source file, this is the style
  type: 'family'; // In source file, this is the persona
  gender: 'unisex';
  text: string;
}

async function insertFamilyPrompts() {
  try {
    console.log('🚀 Starting family prompts insertion...');
    
    // Read the attached file
    const filePath = path.join(process.cwd(), 'attached_assets', 'Pasted-import-type-Prompt-from-types-Note-The-prompts-below-assume-various-family-compositi-1761886792396_1761886792396.txt');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    // Parse prompts using regex
    const promptRegex = /\{[\s\S]*?category:\s*'(daily|travel|film)'[\s\S]*?type:\s*'family'[\s\S]*?gender:\s*'unisex'[\s\S]*?text:\s*"((?:[^"\\]|\\.)*)"/g;
    
    const prompts: ParsedPrompt[] = [];
    let match;
    
    while ((match = promptRegex.exec(fileContent)) !== null) {
      prompts.push({
        category: match[1] as 'daily' | 'travel' | 'film',
        type: 'family',
        gender: 'unisex',
        text: match[2]
      });
    }
    
    console.log(`📝 Parsed ${prompts.length} prompts from file`);
    
    // Validate all prompts have face preservation directive
    const validPrompts = prompts.filter(p => 
      p.text.includes('Preserve the exact facial features and identities of all family members from the reference images')
    );
    
    console.log(`✅ ${validPrompts.length} valid prompts ready for insertion`);
    
    // Count by category (which is actually the style in source file)
    const dailyCount = validPrompts.filter(p => p.category === 'daily').length;
    const travelCount = validPrompts.filter(p => p.category === 'travel').length;
    const filmCount = validPrompts.filter(p => p.category === 'film').length;
    
    console.log(`📊 Distribution:`);
    console.log(`   - Daily: ${dailyCount}`);
    console.log(`   - Travel: ${travelCount}`);
    console.log(`   - Film: ${filmCount}`);
    
    if (validPrompts.length !== 105) {
      console.warn(`⚠️  Expected 105 prompts, but got ${validPrompts.length}`);
    }
    
    if (validPrompts.length > 0) {
      console.log('\nFirst prompt sample:');
      console.log(JSON.stringify(validPrompts[0], null, 2));
    }
    
    // Check if family prompts already exist (category='family')
    const existingFamilyPrompts = await db.query.snapshotPrompts.findMany({
      where: (prompts, { eq }) => eq(prompts.category, 'family')
    });
    
    if (existingFamilyPrompts.length > 0) {
      console.log(`⚠️  Found ${existingFamilyPrompts.length} existing family prompts in database`);
      console.log('❌ Aborting to prevent duplicates');
      console.log('If you want to re-insert, manually delete existing family prompts first.');
      return;
    }
    
    console.log('✅ No existing family prompts found. Safe to proceed.');
    
    // Insert prompts in batches
    const batchSize = 20;
    let inserted = 0;
    let globalOrder = 1; // Start order from 1 for family prompts
    
    for (let i = 0; i < validPrompts.length; i += batchSize) {
      const batch = validPrompts.slice(i, i + batchSize);
      
      // Transform to match our DB schema:
      // Source: category='daily/travel/film' (style), type='family' (persona), gender='unisex', text
      // DB: category='family' (persona), type='daily/travel/film' (style), gender=null, prompt
      const values = batch.map(p => ({
        category: 'family' as const, // category is the persona (family)
        type: p.category as 'daily' | 'travel' | 'film', // type is the style (daily/travel/film)
        gender: null, // Family prompts don't need gender (unisex → null)
        prompt: p.text,
        isActive: true,
        usageCount: 0,
        order: globalOrder++
      }));
      
      await db.insert(snapshotPrompts).values(values);
      inserted += batch.length;
      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}: ${inserted}/${validPrompts.length} prompts`);
    }
    
    console.log(`\n✅ Successfully inserted ${inserted} family prompts!`);
    
    // Verify insertion
    const finalCount = await db.query.snapshotPrompts.findMany({
      where: (prompts, { eq }) => eq(prompts.category, 'family')
    });
    
    console.log(`\n🎉 Final verification: ${finalCount.length} family prompts in database`);
    
    // Count by type (correct field for this pattern)
    const dailyInDb = finalCount.filter(p => p.type === 'daily').length;
    const travelInDb = finalCount.filter(p => p.type === 'travel').length;
    const filmInDb = finalCount.filter(p => p.type === 'film').length;
    
    console.log(`📊 Final distribution:`);
    console.log(`   - Daily: ${dailyInDb}`);
    console.log(`   - Travel: ${travelInDb}`);
    console.log(`   - Film: ${filmInDb}`);
    
    console.log('\n✅ Script completed successfully');
    
  } catch (error) {
    console.error('❌ Error inserting family prompts:', error);
    throw error;
  }
}

insertFamilyPrompts()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
