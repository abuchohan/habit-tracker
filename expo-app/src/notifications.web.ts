import { api } from './api';

let publicKey: string | null = null;
let registration: ServiceWorkerRegistration | undefined;
export function pushSupport(): string {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  if (ios && !installed) return 'On iPhone or iPad (iOS 16.4 or later), tap Share in Safari, choose Add to Home Screen, then open Habits from its icon to enable notifications.';
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'Push is unavailable in this browser. Use the installed app over HTTPS.';
  return '';
}
export async function preparePush() {
  if (pushSupport()) return;
  const config = await api<{ publicKey: string | null }>('/push/config');
  publicKey = config.publicKey;
  registration = await navigator.serviceWorker.getRegistration('/');
}
export async function pushStatus() {
  if (pushSupport()) return false;
  const worker = await navigator.serviceWorker.getRegistration('/');
  return Notification.permission === 'granted' && !!await worker?.pushManager.getSubscription();
}
export async function enablePush() {
  const unsupported = pushSupport();
  if (unsupported) throw new Error(unsupported);
  if (!publicKey) throw new Error('Push reminders are not configured on the server yet.');
  if (!registration?.active) throw new Error('Push needs the published app. Reload it once, then try again.');
  // Invoke immediately from the tap handler: iOS requires a direct user gesture.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were not allowed. You can change this in your device notification settings.');
  const key = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await api('/push/subscribe', subscription.toJSON());
}
export async function disablePush() {
  if (!('serviceWorker' in navigator)) return;
  const worker = await navigator.serviceWorker.getRegistration('/');
  const subscription = await worker?.pushManager.getSubscription();
  if (!subscription) return;
  await api('/push/unsubscribe', { endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}
