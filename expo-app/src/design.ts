import { Platform } from 'react-native';
// white-mint-tiles / Host, dealt by design-taste-frontend.
export const light = {
  bg: '#ffffff', card: '#f3f3f3', paper: '#ffffff', text: '#232323', muted: '#686868',
  line: '#dedede', header: '#f3f3f3', accent: '#232323', onAccent: '#ffffff',
  mint: '#a1ffcb', mintInk: '#232323', soft: '#e9fff2', faint: '#767676', danger: '#b42336',
};
export const dark: typeof light = {
  bg: '#171717', card: '#232323', paper: '#1c1c1c', text: '#f4f4f4', muted: '#b0b0b0',
  line: '#3c3c3c', header: '#1c1c1c', accent: '#a1ffcb', onAccent: '#232323',
  mint: '#a1ffcb', mintInk: '#232323', soft: '#263b2e', faint: '#aaaaaa', danger: '#ff9fa9',
};
export const face = Platform.OS === 'web' ? 'Host Grotesk' : 'System';
export const mono = Platform.OS === 'web' ? 'JetBrains Mono' : 'monospace';
export const radii = { control: 10, panel: 16, sheet: 24 };
export function foregroundOn(color: string) {
  const rgb = [1, 3, 5].map(start => {
    const c = parseInt(color.slice(start, start + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179 ? '#000000' : '#ffffff';
}
// The unmodified skill motion layer targets classes; native retains Pressable feedback.
export function webClass(names: string) {
  return (node: unknown) => {
    if (Platform.OS === 'web' && node) (node as HTMLElement).classList?.add(...names.split(' '));
  };
}
