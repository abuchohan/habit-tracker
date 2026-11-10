import { useSyncExternalStore } from 'react';

const touchQuery = '(any-pointer: coarse), (hover: none)';
function subscribeTouchDevice(onChange: () => void) {
  const media = window.matchMedia(touchQuery);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
export function useTouchDevice() {
  return useSyncExternalStore(subscribeTouchDevice, () => window.matchMedia(touchQuery).matches, () => false);
}

export function installOffline() {
  // Expo's dev shell does not run prepare-web.cjs; use the same local assets there.
  for (const href of ['/appearance.css', '/assets/motion/motion.css']) {
    if (!document.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; document.head.appendChild(link);
    }
  }
  if (!document.querySelector('script[src="/assets/motion/motion.js"]')) {
    const script = document.createElement('script'); script.type = 'module'; script.src = '/assets/motion/motion.js'; document.head.appendChild(script);
  }
  if ('serviceWorker' in navigator && !__DEV__) navigator.serviceWorker.register('/sw.js').catch(console.warn);
}
export function applyAppearance(theme: { bg: string; text: string; accent: string }, reduced: boolean, ready: boolean) {
  document.documentElement.style.setProperty('--bg', theme.bg);
  document.documentElement.style.setProperty('--ink', theme.text);
  document.documentElement.style.setProperty('--action', theme.accent);
  document.documentElement.dataset.motion = reduced ? 'off' : '';
  document.documentElement.dataset.ready = ready ? '1' : '';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.bg);
}
export function watchConnectivity(fn: () => void) {
  window.addEventListener('online', fn); window.addEventListener('focus', fn);
  return () => { window.removeEventListener('online', fn); window.removeEventListener('focus', fn); };
}
export function resetToken() { return new URLSearchParams(location.search).get('reset'); }
export function clearResetToken() { history.replaceState({}, '', location.pathname); }
export async function download(name: string, content: string | Uint8Array, mime = 'application/json') {
  const blob = new Blob([content as BlobPart], { type: mime }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function pickFile(): Promise<{ name: string; bytes: Uint8Array } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,.db,.sqlite,.sqlite3';
    input.onchange = async () => { try { const f = input.files?.[0]; if (f && f.size > 50 * 1024 * 1024) throw new Error('Backup is too large (maximum 50 MB).'); resolve(f ? { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } : null); } catch (e) { reject(e); } };
    input.oncancel = () => resolve(null); input.click();
  });
}
