'use client';

import { api } from '@/lib/api/client';

/**
 * Browser and phone notifications (Web Push). The service worker at /sw.js
 * shows them; the API decides when to send (only while the player is away
 * from the site).
 */
export type PushState =
  /** No Push API here, or iOS Safari outside a home-screen app. */
  | 'unsupported'
  | 'needs-install'
  | 'denied'
  | 'off'
  | 'on'
  /** The server has no push keys configured. */
  | 'unavailable';

export function isIos(): boolean {
  return typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  return existing ?? navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

async function existingSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

function toInput(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return { endpoint: json.endpoint!, keys: { p256dh: json.keys!.p256dh!, auth: json.keys!.auth! } };
}

export async function currentPushState(): Promise<PushState> {
  // iPhone and iPad only allow web push for sites added to the Home Screen.
  if (isIos() && (!pushSupported() || !isStandalone())) return 'needs-install';
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  return (await existingSubscription()) ? 'on' : 'off';
}

export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return currentPushState();
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'off';
  const { publicKey } = await api.push.config();
  if (!publicKey) return 'unavailable';

  const reg = await registration();
  await navigator.serviceWorker.ready;
  let subscription = await reg.pushManager.getSubscription();
  const key = keyBytes(publicKey);
  try {
    subscription ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  } catch {
    // Subscribed earlier with another server key: start over.
    await subscription?.unsubscribe();
    subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  }
  await api.push.subscribe(toInput(subscription));
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  const subscription = await existingSubscription();
  if (subscription) {
    await api.push.unsubscribe(subscription.endpoint).catch(() => undefined);
    await subscription.unsubscribe();
  }
  return 'off';
}

/**
 * After every sign-in: a browser that already allowed notifications is
 * re-linked to whoever is signed in now, and to their current session.
 */
export async function resyncPushSubscription(): Promise<void> {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return;
    const subscription = await existingSubscription();
    if (subscription) await api.push.subscribe(toInput(subscription));
  } catch {
    // Best effort; the settings toggle shows the real state.
  }
}
