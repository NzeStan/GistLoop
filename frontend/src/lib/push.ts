/**
 * Browser push notifications through Firebase Cloud Messaging (the backend sends with FCM_PROJECT_ID).
 *
 * Configure in frontend/.env: VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID,
 * VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID and VITE_FIREBASE_VAPID_KEY (Firebase console →
 * Project settings → Cloud Messaging → Web Push certificates). Without them, push is simply not offered.
 * The Firebase SDK is only downloaded when someone turns notifications on or off. Nothing is stored in
 * the browser: the push subscription itself says whether this browser is signed up.
 */
import { UserFacingError } from "@/api/errors";

const env = import.meta.env;
const WORKER = "/push-sw.js";

export const pushConfigured = Boolean(
  env.VITE_FIREBASE_API_KEY &&
  env.VITE_FIREBASE_PROJECT_ID &&
  env.VITE_FIREBASE_MESSAGING_SENDER_ID &&
  env.VITE_FIREBASE_APP_ID &&
  env.VITE_FIREBASE_VAPID_KEY,
);

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function messaging() {
  const [{ initializeApp, getApps }, fcm] = await Promise.all([import("@firebase/app"), import("@firebase/messaging")]);
  const app =
    getApps()[0] ??
    initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    });
  return { fcm, instance: fcm.getMessaging(app) };
}

/** Whether this browser currently receives GistLoop pushes. */
export async function browserPushActive(): Promise<boolean> {
  if (!pushConfigured || !pushSupported() || Notification.permission !== "granted") return false;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return Boolean(await registration?.pushManager.getSubscription());
}

/** Ask permission, subscribe this browser and return its FCM token (register it with the API). */
export async function enableBrowserPush(): Promise<string> {
  if (!pushConfigured || !pushSupported())
    throw new UserFacingError("Push notifications aren't available in this browser.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new UserFacingError("Notifications are blocked. Allow them in your browser's site settings.");
  const registration = await navigator.serviceWorker.register(WORKER, { scope: "/" });
  const { fcm, instance } = await messaging();
  const token = await fcm.getToken(instance, {
    vapidKey: env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new UserFacingError("Couldn't turn on notifications. Please try again.");
  return token;
}

/** Stop pushes to this browser. Returns the token it had, so the API can forget it too. */
export async function disableBrowserPush(): Promise<string | null> {
  const registration = await navigator.serviceWorker?.getRegistration("/");
  let token: string | null = null;
  if (registration && pushConfigured) {
    const { fcm, instance } = await messaging();
    try {
      token = await fcm.getToken(instance, {
        vapidKey: env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration,
      });
      await fcm.deleteToken(instance);
    } catch {
      token = null;
    }
  }
  await (await registration?.pushManager.getSubscription())?.unsubscribe();
  return token;
}
