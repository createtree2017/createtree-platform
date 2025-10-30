import fs from 'fs';
import path from 'path';

/**
 * Import remaining prompts with better error handling and rate limiting
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
    const API_URL = 'http://localhost:5000';
    const adminEmail = '9059056@gmail.com';
    const adminPassword = '123456';

    console.log(`\n🔐 Logging in...`);
    
    // Login
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: adminEmail, password: adminPassword })
    });

    if (!loginResponse.ok) {
      console.error('Login failed:', await loginResponse.text());
      process.exit(1);
    }

    const setCookie = loginResponse.headers.get('set-cookie');
    console.log(`✅ Login successful\n`);

    // Parse prompts
    const filePath = path.join(process.cwd(), 'scripts', 'prompts-source.txt');
    const filePrompts = parsePromptsFile(filePath);
    const dbPrompts = filePrompts.map(mapToDBFormat);

    console.log(`📝 Starting to insert ${dbPrompts.length} prompts...\n`);
    console.log(`API URL: ${API_URL}/api/snapshot-prompts\n`);

    let successCount = 0;
    let skipCount = 0;

    // Insert one by one with delay to avoid rate limit
    for (let i = 0; i < dbPrompts.length; i++) {
      const prompt = dbPrompts[i];
      
      try {
        const response = await fetch(`${API_URL}/api/snapshot-prompts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': setCookie || ''
          },
          body: JSON.stringify(prompt)
        });

        const responseText = await response.text();
        
        if (response.ok) {
          successCount++;
          const preview = prompt.prompt.substring(0, 50);
          console.log(`✅ [${i + 1}/${dbPrompts.length}] ${prompt.type} - ${preview}...`);
        } else if (response.status === 409) {
          skipCount++;
        } else {
          console.log(`❌ [${i + 1}] Error ${response.status}: ${responseText}`);
        }
      } catch (error) {
        console.error(`❌ [${i + 1}] Network error:`, error);
      }

      // Wait 700ms between requests to stay under rate limit (100 req/60sec = 600ms)
      if ((i + 1) < dbPrompts.length) {
        await new Promise(resolve => setTimeout(resolve, 700));
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Added: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`\n🎉 Complete!\n`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
