import "dotenv/config";
import { getFirebaseMessaging, getFirebaseAdmin } from "../server/services/firebase-admin";

async function main() {
  try {
    console.log("Initializing Firebase Admin...");
    const admin = getFirebaseAdmin();
    console.log("Admin initialized.", admin.name);

    console.log("Getting Messaging...");
    const messaging = getFirebaseMessaging();
    console.log("Messaging acquired.");
  } catch (error) {
    console.error("Test Error:", error);
  }
}

main();
