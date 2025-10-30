/**
 * Test adding a single prompt to verify API functionality
 */

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
      const errorText = await loginResponse.text();
      console.error('❌ Login failed:', errorText);
      process.exit(1);
    }

    const setCookie = loginResponse.headers.get('set-cookie');
    console.log(`✅ Login successful`);
    console.log(`📝 Cookie: ${setCookie?.substring(0, 50)}...`);

    // Test data
    const testPrompt = {
      category: 'individual',
      type: 'daily',
      gender: null,
      prompt: 'TEST PROMPT - A simple test prompt to verify API functionality',
      isActive: true
    };

    console.log(`\n📤 Sending test prompt...`);
    console.log(`URL: ${API_URL}/api/snapshot-prompts`);
    console.log(`Data:`, JSON.stringify(testPrompt, null, 2));

    const response = await fetch(`${API_URL}/api/snapshot-prompts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': setCookie || ''
      },
      body: JSON.stringify(testPrompt)
    });

    console.log(`\n📨 Response status: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    console.log(`📨 Response body:`, responseText);

    if (response.ok) {
      console.log(`\n✅ SUCCESS! Prompt added`);
    } else {
      console.log(`\n❌ FAILED! Status ${response.status}`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
