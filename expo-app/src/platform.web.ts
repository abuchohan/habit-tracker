export function installOffline() {
  if ('serviceWorker' in navigator && !__DEV__) navigator.serviceWorker.register('/sw.js').catch(console.warn);
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
