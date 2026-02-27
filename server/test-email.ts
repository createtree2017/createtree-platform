import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD;

console.log('Testing with USER:', user);
console.log('PASS exists?', !!pass);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: user,
        pass: pass
    }
});

async function test() {
    try {
        await transporter.verify();
        console.log('Connection successful!');

        // Test sending an email
        const info = await transporter.sendMail({
            from: `"Test Server" <${user}>`,
            to: 'topcom77@gmail.com', // just a test or to the same email
            subject: 'Test SMTP',
            text: 'Working!'
        });
        console.log('Sent:', info.messageId);
    } catch (error) {
        console.error('SMTP Error:', error);
    }
}

test();
