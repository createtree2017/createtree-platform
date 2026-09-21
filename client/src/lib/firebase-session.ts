// Firebase SDK 객체의 검증 가능한 ID 토큰만 서버로 전달한다.
export async function exchangeFirebaseIdToken(user: { getIdToken: () => Promise<string> }) {
  const idToken = await user.getIdToken();
  return fetch('/api/auth/firebase-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken }),
  });
}
