import fs from 'fs';
import path from 'path';

/**
 * Bulk import script for snapshot prompts
 * Parses the provided file and inserts 105 individual prompts via API
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

/**
 * Parse prompts from file by reading and evaluating the array
 */
function parsePromptsFile(filePath: string): FilePrompt[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Extract just the array content, removing import/export statements
  // Find the array between [ and ];
  const startMatch = content.indexOf('[');
  const endMatch = content.lastIndexOf('];');
  
  if (startMatch === -1 || endMatch === -1) {
    throw new Error('Could not find array in file');
  }
  
  const arrayContent = content.substring(startMatch, endMatch + 1);
  
  // Use eval to parse the JavaScript array (safe since we control the input)
  const prompts = eval(arrayContent) as FilePrompt[];
  
  return prompts;
}

/**
 * Map file format to database format
 */
function mapToDBFormat(filePrompt: FilePrompt): DBPrompt {
  return {
    category: 'individual', // type in file → category in DB
    type: filePrompt.category, // category in file → type in DB  
    gender: null, // unisex → null
    prompt: filePrompt.text,
    isActive: true
  };
}

/**
 * Insert prompts via API
 */
async function insertPrompts(prompts: DBPrompt[]): Promise<{ success: number; skip: number; error: number }> {
  const API_URL = process.env.VITE_API_URL || 'http://localhost:5000';
  const adminEmail = '9059056@gmail.com';
  const adminPassword = '123456';

  console.log(`🔐 Logging in as admin (${adminEmail})...`);
  
  // 1. Login to get auth cookie
  const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: adminEmail, password: adminPassword }),
    credentials: 'include'
  });

  if (!loginResponse.ok) {
    const errorText = await loginResponse.text();
    throw new Error(`Login failed: ${loginResponse.statusText} - ${errorText}`);
  }

  // Extract cookie from response
  const setCookie = loginResponse.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('No auth cookie received from login');
  }

  console.log(`✅ Login successful\n`);

  // 2. Insert prompts one by one
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  console.log(`📝 Inserting ${prompts.length} prompts...\n`);

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    const num = i + 1;
    const preview = prompt.prompt.substring(0, 60).replace(/\n/g, ' ');

    try {
      const response = await fetch(`${API_URL}/api/snapshot-prompts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': setCookie
        },
        body: JSON.stringify(prompt)
      });

      if (response.ok) {
        successCount++;
        console.log(`✅ [${num}/${prompts.length}] ${prompt.type.padEnd(6)} | ${preview}...`);
      } else if (response.status === 409) {
        skipCount++;
        console.log(`⏭️  [${num}/${prompts.length}] ${prompt.type.padEnd(6)} | Already exists (skipped)`);
      } else {
        errorCount++;
        const errorText = await response.text();
        const errorMsg = `[${num}] ${prompt.type} - ${response.status}: ${errorText}`;
        errors.push(errorMsg);
        console.log(`❌ [${num}/${prompts.length}] ${prompt.type.padEnd(6)} | Error: ${response.status}`);
      }
    } catch (error) {
      errorCount++;
      const errorMsg = `[${num}] ${prompt.type} - ${error}`;
      errors.push(errorMsg);
      console.log(`❌ [${num}/${prompts.length}] ${prompt.type.padEnd(6)} | Network error`);
    }

    // Small delay to avoid overwhelming the server
    if ((i + 1) % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Import Summary:`);
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Successfully added: ${successCount} prompts`);
  console.log(`⏭️  Skipped (duplicates): ${skipCount} prompts`);
  console.log(`❌ Errors: ${errorCount} prompts`);
  console.log(`📝 Total processed: ${prompts.length} prompts`);
  console.log(`${'='.repeat(60)}\n`);

  if (errors.length > 0) {
    console.log(`⚠️  Error details:`);
    errors.forEach(err => console.log(`   ${err}`));
    console.log('');
  }

  return { success: successCount, skip: skipCount, error: errorCount };
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Snapshot Prompts Bulk Import`);
    console.log(`${'='.repeat(60)}\n`);

    const filePath = path.join(process.cwd(), 'scripts', 'prompts-source.txt');

    console.log(`📂 Reading file: ${path.basename(filePath)}`);
    const filePrompts = parsePromptsFile(filePath);
    console.log(`✅ Parsed ${filePrompts.length} prompts from file\n`);

    // Map to DB format
    const dbPrompts = filePrompts.map(mapToDBFormat);

    // Group by type for summary
    const byType = dbPrompts.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`📊 Breakdown by type:`);
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   ${type.padEnd(6)}: ${count} prompts`);
    });
    console.log('');

    // Confirm before proceeding
    console.log(`⚠️  This will insert ${dbPrompts.length} prompts into the database.`);
    console.log(`   Category: individual`);
    console.log(`   Types: daily, travel, film\n`);

    // Insert via API
    const result = await insertPrompts(dbPrompts);

    console.log(`🎉 Import complete!\n`);
    console.log(`👉 Next steps:`);
    console.log(`   1. Open the admin page in your browser`);
    console.log(`   2. Navigate to: 관리자 페이지 > 스냅샷 프롬프트 관리`);
    console.log(`   3. Verify all ${result.success > 0 ? result.success : dbPrompts.length} prompts are visible\n`);
    
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    console.error('\nPlease check:');
    console.error('   1. The server is running (npm run dev)');
    console.error('   2. The admin account exists (9059056@gmail.com / 123456)');
    console.error('   3. The prompts file is in the correct location\n');
    process.exit(1);
  }
}

main();
