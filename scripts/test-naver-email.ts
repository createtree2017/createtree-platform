import "dotenv/config";
import nodemailer from "nodemailer";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function testEmailAndUser() {
  try {
    console.log("1. Checking if user exists in DB...");
    const userResult = await pool.query(
      "SELECT id, username, email FROM users WHERE email = $1",
      ['imusiwer@naver.com']
    );
    console.log("User query result:", userResult.rows);

    if (userResult.rows.length === 0) {
      console.log("User does not exist in DB!");
    } else {
      console.log(`User exists! ID: ${userResult.rows[0].id}`);
      
      console.log("\n2. Checking if token was created...");
      const tokenResult = await pool.query(
        "SELECT id, token, created_at FROM password_reset_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [userResult.rows[0].id]
      );
      console.log("Latest token:", tokenResult.rows);
    }

    console.log("\n3. Testing email dispatch to Naver...");
    const GMAIL_USER = process.env.GMAIL_USER;
    const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      console.log("Missing Gmail credentials in .env");
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: `"우리병원 문화센터" <${GMAIL_USER}>`,
      to: 'imusiwer@naver.com',
      subject: '[테스트] 우리병원 문화센터 발송 테스트',
      html: '<p>이 메일은 시스템 발송 테스트 메일입니다.</p>',
    });

    console.log("Email sent successfully!");
    console.log("Message ID:", info.messageId);
    console.log("Accepted:", info.accepted);
    console.log("Rejected:", info.rejected);
    console.log("Response:", info.response);
    
  } catch (err) {
    console.error("Error occurred:");
    console.error(err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testEmailAndUser();
