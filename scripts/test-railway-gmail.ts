import nodemailer from "nodemailer";

async function testGmail() {
  console.log("Testing Gmail SMTP...");
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'ct.createtree@gmail.com',
      pass: 'kacj irxo hbun cjfh',
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `"우리병원 문화센터" <ct.createtree@gmail.com>`,
      to: 'imusiwer@naver.com',
      subject: '[테스트] ct.createtree@gmail.com 발송 테스트',
      html: '<p>이 메일은 시스템 발송 테스트 메일입니다.</p>',
    });
    console.log("Email sent successfully!");
    console.log("Message ID:", info.messageId);
  } catch (err) {
    console.error("Error occurred:");
    console.error(err);
  }
}

testGmail();
