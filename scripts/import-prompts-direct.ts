import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { snapshotPrompts } from '../shared/schema';

/**
 * Direct database import of snapshot prompts using Drizzle ORM
 */

interface FilePrompt {
  category: 'daily' | 'travel' | 'film';
  type: 'individual';
  gender: 'unisex';
  text: string;
}

interface DBPrompt {
  category: 'individual';
  type: 'daily' | 'travel' | 'film';
  gender: null;
  prompt: string;
  isActive: boolean;
}

function parsePromptsFile(filePath: string): FilePrompt[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const startMatch = content.indexOf('[');
  const endMatch = content.lastIndexOf('];');
  
  if (startMatch === -1 || endMatch === -1) {
    throw new Error('Could not find array in file');
  }
  
  const arrayContent = content.substring(startMatch, endMatch + 1);
  const prompts = eval(arrayContent) as FilePrompt[];
  
  return prompts;
}

function mapToDBFormat(filePrompt: FilePrompt): DBPrompt {
  return {
    category: 'individual',
    type: filePrompt.category,
    gender: null,
    prompt: filePrompt.text,
    isActive: true
  };
}

async function main() {
  try {
    console.log(`\n📝 Starting direct database import...\n`);

    // Parse prompts from file
    const filePath = path.join(process.cwd(), 'scripts', 'prompts-source.txt');
    const filePrompts = parsePromptsFile(filePath);
    const dbPrompts = filePrompts.map(mapToDBFormat);

    console.log(`Found ${dbPrompts.length} prompts to import\n`);

    // Group by type for display
    const byType = dbPrompts.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`Distribution:`);
    console.log(`  Daily: ${byType.daily || 0}`);
    console.log(`  Travel: ${byType.travel || 0}`);
    console.log(`  Film: ${byType.film || 0}`);
    console.log();

    // Insert all prompts in one batch
    console.log(`⏳ Inserting ${dbPrompts.length} prompts into database...`);
    
    const inserted = await db
      .insert(snapshotPrompts)
      .values(dbPrompts)
      .returning();

    console.log(`\n✅ Successfully inserted ${inserted.length} prompts!`);
    console.log(`\n📊 Summary:`);
    console.log(`   Total: ${inserted.length}`);
    
    // Show sample IDs
    const sampleIds = inserted.slice(0, 5).map(p => p.id);
    console.log(`   Sample IDs: ${sampleIds.join(', ')}...`);
    
    console.log(`\n🎉 Import complete!\n`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
