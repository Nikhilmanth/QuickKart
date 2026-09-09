// Firebase Phone-Auth bridge — used only when the server reports firebase enabled.
import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

let auth = null;
let confirmationResult = null;

export function initFirebase(config) {
  if (!config?.apiKey) return false;
  const app = initializeApp(config);
  auth = getAuth(app);
  return true;
}

export async function sendPhoneOtp(phoneE164) {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
    await window.recaptchaVerifier.render();
  }
  confirmationResult = await signInWithPhoneNumber(auth, phoneE164, window.recaptchaVerifier);
}

export async function confirmPhoneOtp(code) {
  const cred = await confirmationResult.confirm(code);
  return cred.user.getIdToken();
}
