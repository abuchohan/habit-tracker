import { AppState } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
export function installOffline() {}
export function applyAppearance(_theme: { bg: string; text: string; accent: string }, _reduced: boolean, _ready: boolean) {}
export function watchConnectivity(fn: () => void) { const subscription = AppState.addEventListener('change', state => { if (state === 'active') fn(); }); return () => subscription.remove(); }
export function resetToken(): string | null { return null; }
export function clearResetToken() {}
export async function download(name: string, content: string | Uint8Array, mime = 'application/json') {
  const file = new File(Paths.cache, name); file.write(content); await Sharing.shareAsync(file.uri, { mimeType: mime });
}
export async function pickFile() {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0]; if (asset.size && asset.size > 50 * 1024 * 1024) throw new Error('Backup is too large (maximum 50 MB).');
  return { name: asset.name, bytes: await new File(asset.uri).bytes() };
}
