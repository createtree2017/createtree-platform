// Test script: Query user_devices table and send a test push using Firebase Admin SDK
import admin from 'firebase-admin';
import pg from 'pg';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const { Client } = pg;

// Firebase Admin init
const serviceAccount = JSON.parse(readFileSync('./createtreeai-firebase-adminsdk-fbsvc-05820a1b62.json', 'utf-8'));

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

// DB query
const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_ZjrNQe7CY2JI@ep-wandering-term-ako0hi2m.c-3.us-west-2.aws.neon.tech/neondb',
    ssl: { rejectUnauthorized: false },
});

try {
    await client.connect();
    console.log('✅ DB connected');

    const result = await client.query(
        'SELECT id, user_id, device_token, device_type, is_active FROM user_devices WHERE is_active = true ORDER BY last_used_at DESC LIMIT 5'
    );

    console.log(`\n📋 Found ${result.rows.length} active device tokens:`);
    for (const row of result.rows) {
        console.log(`  User ID: ${row.user_id}, Type: ${row.device_type}, Token: ${row.device_token.substring(0, 20)}...`);
    }

    if (result.rows.length === 0) {
        console.log('\n❌ No device tokens found in DB. Make sure the app registered a token after logging in.');
        console.log('   Also check if db:push was completed for the user_devices table.');
    } else {
        // Send test push to the most recent token
        const latestToken = result.rows[0].device_token;
        console.log(`\n🚀 Sending test push to token: ${latestToken.substring(0, 20)}...`);

        const message = {
            notification: {
                title: '🎉 createtree 푸시 테스트!',
                body: '안녕하세요! FCM 푸시 알림이 정상적으로 작동합니다. 🚀',
            },
            token: latestToken,
        };

        const response = await admin.messaging().send(message);
        console.log(`\n✅ Push sent successfully! Message ID: ${response}`);
    }
} catch (error) {
    console.error('Error:', error.message);
} finally {
    await client.end();
}
