import "dotenv/config";
import { getFirebaseMessaging } from "../server/services/firebase-admin";

async function main() {
  try {
    const defaultToken = "dH1IHOxHRq-XZyQVSORVax:APA91bG3Z3ZDF7ZLsa2SK4kvSvsEMI4PeO4JTxnRluPKCYEswYoMseHxv8AZdQ-hkF6TxuHuVLor4s0QP3h5aWO2vDUOXTVTOBpwrbHgKrNxQpib3cr_cB0";
    console.log("Sending test push to token:", defaultToken);

    const messaging = getFirebaseMessaging();
    const message = {
      token: defaultToken,
      notification: {
        title: "🔥 긴급 테스트",
        body: "관리자님! 이 알림이 휴대폰 상단에 뜨나요? (FCM 직접 발송)",
      },
      data: {
        type: "system_notice",
        action_url: "/",
      }
    };

    const response = await messaging.send(message);
    console.log("✅ Successfully sent message:", response);
  } catch (err) {
    console.error("❌ Send Error:", err);
  }
}

main();
