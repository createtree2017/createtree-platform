import "dotenv/config";
import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

console.log("GMAIL_USER:", GMAIL_USER);
console.log("GMAIL_APP_PASSWORD:", GMAIL_APP_PASSWORD ? "[Set]" : "[Not Set]");

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD
  }
});

async function testEmail() {
  try {
    const info = await transporter.sendMail({
      from: `우리병원 문화센터 <${GMAIL_USER}>`,
      to: "ct.createtree@gmail.com", // testing account
      subject: "Test Email from createTree",
      text: "If you receive this, email sending works."
    });
    console.log("Test email sent success:", info.messageId);
  } catch (err) {
    console.error("Test email send failed:", err);
  }
}

testEmail();
