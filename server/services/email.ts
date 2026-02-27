import nodemailer from 'nodemailer';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// Gmail 설정 확인
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.warn('⚠️ Gmail 설정이 없습니다. 이메일 기능이 작동하지 않습니다.');
}

// Nodemailer 전송 객체 생성
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD
  }
});

// 이메일 템플릿
const emailTemplates = {
  passwordReset: (resetUrl: string, expiresIn: string) => ({
    subject: '[우리병원 문화센터] 비밀번호 재설정 안내',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #6c757d; font-size: 12px; margin-top: 30px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>비밀번호 재설정</h1>
          </div>
          <div class="content">
            <p>안녕하세요,</p>
            <p>우리병원 문화센터 비밀번호 재설정을 요청하셨습니다.</p>
            <p>아래 버튼을 클릭하여 새로운 비밀번호를 설정해주세요:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">비밀번호 재설정하기</a>
            </div>
            
            <div class="warning">
              <strong>⚠️ 주의사항:</strong>
              <ul style="margin: 5px 0; padding-left: 20px;">
                <li>이 링크는 ${expiresIn} 동안만 유효합니다.</li>
                <li>비밀번호 재설정을 요청하지 않으셨다면 이 이메일을 무시하세요.</li>
                <li>보안을 위해 링크를 다른 사람과 공유하지 마세요.</li>
              </ul>
            </div>
            
            <p style="color: #6c757d; font-size: 14px;">
              버튼이 작동하지 않는 경우, 아래 링크를 브라우저에 직접 붙여넣어 주세요:<br>
              <span style="word-break: break-all; color: #667eea;">${resetUrl}</span>
            </p>
          </div>
          <div class="footer">
            <p>이 메일은 자동으로 발송된 메일입니다. 회신하지 마세요.</p>
            <p>© 2025 우리병원 문화센터. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  passwordResetSuccess: () => ({
    subject: '[우리병원 문화센터] 비밀번호가 변경되었습니다',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-radius: 0 0 10px 10px; }
          .success { color: #28a745; font-size: 18px; font-weight: bold; }
          .footer { text-align: center; color: #6c757d; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>비밀번호 변경 완료</h1>
          </div>
          <div class="content">
            <p class="success">✓ 비밀번호가 성공적으로 변경되었습니다.</p>
            <p>변경 시간: ${format(new Date(), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}</p>
            
            <p style="margin-top: 30px;">
              <strong>보안 안내:</strong><br>
              만약 본인이 변경하지 않으셨다면 즉시 고객센터로 문의해주세요.
            </p>
          </div>
          <div class="footer">
            <p>© 2025 우리병원 문화센터. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  verification: (verifyUrl: string) => ({
    subject: '[우리병원 문화센터] 이메일 주소 인증 안내',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; color: #6c757d; font-size: 12px; margin-top: 30px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>이메일 주소 인증</h1>
          </div>
          <div class="content">
            <p>안녕하세요,</p>
            <p>우리병원 문화센터 계정 보안 강화를 위한 이메일 인증 절차입니다.</p>
            <p>아래 버튼을 클릭하여 본인 이메일 주소가 맞는지 확인해 주세요:</p>
            
            <div style="text-align: center;">
              <a href="${verifyUrl}" class="button">이메일 인증하기</a>
            </div>
            
            <div class="warning">
              <strong>⚠️ 주의사항:</strong>
              <ul style="margin: 5px 0; padding-left: 20px;">
                <li>이 링크는 24시간 동안만 유효합니다.</li>
                <li>본인이 인증을 요청하지 않으셨다면 이 이메일을 무시하세요.</li>
              </ul>
            </div>
            
            <p style="color: #6c757d; font-size: 14px;">
              버튼이 작동하지 않는 경우, 아래 링크를 브라우저에 직접 붙여넣어 주세요:<br>
              <span style="word-break: break-all; color: #f59e0b;">${verifyUrl}</span>
            </p>
          </div>
          <div class="footer">
            <p>이 메일은 자동으로 발송된 메일입니다. 회신하지 마세요.</p>
            <p>© 2025 우리병원 문화센터. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  })
};

// 이메일 발송 함수
export async function sendPasswordResetEmail(to: string, resetUrl: string, expiresIn: string) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('Gmail 설정이 없어 이메일을 발송할 수 없습니다.');
    throw new Error('이메일 서비스가 설정되지 않았습니다.');
  }

  try {
    const emailContent = emailTemplates.passwordReset(resetUrl, expiresIn);

    const mailOptions = {
      from: `우리병원 문화센터 <${GMAIL_USER}>`,
      to,
      subject: emailContent.subject,
      html: emailContent.html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('비밀번호 재설정 이메일 발송 성공:', info.messageId);
    return info;
  } catch (error) {
    console.error('이메일 발송 실패:', error);
    throw new Error('이메일 발송에 실패했습니다.');
  }
}

export async function sendPasswordResetSuccessEmail(to: string) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('Gmail 설정이 없어 이메일을 발송할 수 없습니다.');
    throw new Error('이메일 서비스가 설정되지 않았습니다.');
  }

  try {
    const emailContent = emailTemplates.passwordResetSuccess();

    const mailOptions = {
      from: `우리병원 문화센터 <${GMAIL_USER}>`,
      to,
      subject: emailContent.subject,
      html: emailContent.html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('비밀번호 변경 완료 이메일 발송 성공:', info.messageId);
    return info;
  } catch (error) {
    console.error('이메일 발송 실패:', error);
    throw new Error('이메일 발송에 실패했습니다.');
  }
}

// 이메일 유효성 검사
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 인증 이메일 발송 함수
export async function sendVerificationEmail(to: string, verifyUrl: string) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('Gmail 설정이 없어 이메일을 발송할 수 없습니다.');
    throw new Error('이메일 서비스가 설정되지 않았습니다.');
  }

  try {
    const emailContent = emailTemplates.verification(verifyUrl);

    const mailOptions = {
      from: `우리병원 문화센터 <${GMAIL_USER}>`,
      to,
      subject: emailContent.subject,
      html: emailContent.html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('이메일 주소 인증 이메일 발송 성공:', info.messageId);
    return info;
  } catch (error) {
    console.error('이메일 발송 실패:', error);
    throw new Error('이메일 발송에 실패했습니다.');
  }
}