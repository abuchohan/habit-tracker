import React, { createContext, useContext } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, TextInputProps, View } from 'react-native';
export const light = { bg: '#eeeeee', card: '#ffffff', text: '#303030', muted: '#767676', line: '#dddddd', header: '#424242', accent: '#1976d2', faint: '#d4d4d4' };
export const dark = { bg: '#151515', card: '#252525', text: '#eeeeee', muted: '#aaaaaa', line: '#3c3c3c', header: '#303030', accent: '#70b4ff', faint: '#555555' };
export const Theme = createContext(light);
export const useTheme = () => useContext(Theme);
export function Label({ children, muted = false, style }: { children: React.ReactNode; muted?: boolean; style?: any }) {
  const t = useTheme(); return <Text style={[{ color: muted ? t.muted : t.text, fontSize: 15, lineHeight: 22 }, style]}>{children}</Text>;
}
export function Button({ children, onPress, primary = false, danger = false, disabled = false, label, style }: {
  children: React.ReactNode; onPress: () => void; primary?: boolean; danger?: boolean; disabled?: boolean; label?: string; style?: any;
}) {
  const t = useTheme(); return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [{ paddingHorizontal: 14, minHeight: 44, paddingVertical: 11, borderRadius: 4, alignItems: 'center', justifyContent: 'center',
      backgroundColor: primary ? t.accent : 'transparent', opacity: disabled ? 0.4 : pressed ? 0.65 : 1 }, style]}>
    <Text style={{ color: primary ? '#ffffff' : danger ? '#d32f2f' : t.accent, fontWeight: '600', fontSize: 14 }}>{children}</Text>
  </Pressable>;
}
export function Input({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme(); return <View style={{ gap: 6, flexShrink: 1 }}><Label muted style={{ fontSize: 13 }}>{label}</Label>
    <TextInput {...props} accessibilityLabel={label} placeholderTextColor={t.muted}
      style={[{ backgroundColor: t.bg, borderWidth: 1, borderColor: t.line, borderRadius: 4, padding: 12, minHeight: 46, color: t.text, fontSize: 16 }, props.style]} /></View>;
}
export function Check({ label, value, onChange, detail }: { label: string; value: boolean; onChange: (v: boolean) => void; detail?: string }) {
  const t = useTheme(); return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: value }} accessibilityLabel={label}
    onPress={() => onChange(!value)} style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, alignItems: 'center', minHeight: 48 }}>
    <View style={{ width: 21, height: 21, borderWidth: 2, borderColor: value ? t.accent : t.muted, backgroundColor: value ? t.accent : 'transparent', alignItems: 'center', borderRadius: 2 }}>
      {value && <Text style={{ color: 'white', fontWeight: 'bold', lineHeight: 17 }}>✓</Text>}</View>
    <View style={{ flex: 1 }}><Label>{label}</Label>{detail && <Label muted style={{ fontSize: 12 }}>{detail}</Label>}</View>
  </Pressable>;
}
export function Choices<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (value: T) => void }) {
  const t = useTheme(); return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{options.map(([id, label]) =>
    <Pressable key={id} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: value === id }} onPress={() => onChange(id)}
      style={{ borderWidth: 1, borderColor: value === id ? t.accent : t.line, backgroundColor: value === id ? t.accent + '18' : 'transparent', paddingHorizontal: 12, paddingVertical: 10, minHeight: 42, borderRadius: 4 }}>
      <Text style={{ color: value === id ? t.accent : t.text, fontSize: 13 }}>{label}</Text></Pressable>)}</View>;
}
export function Sheet({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const t = useTheme(); return <Modal visible animationType="fade" transparent onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: '#00000088', justifyContent: 'center', alignItems: 'center', padding: 12 }}>
      <View accessibilityViewIsModal style={{ backgroundColor: t.card, borderRadius: 6, width: '100%', maxWidth: wide ? 840 : 500, maxHeight: '94%', overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: t.line, paddingLeft: 20, paddingRight: 8, paddingVertical: 8 }}>
          <Label style={{ fontSize: 20, fontWeight: '500', flex: 1 }}>{title}</Label><Button label="Close dialog" onPress={onClose}>✕</Button></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 18 }}>{children}</ScrollView>
      </View></View>
  </Modal>;
}
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme(); return <View style={{ gap: 14, backgroundColor: t.card, padding: 20, borderRadius: 3 }}>
    <Label style={{ fontSize: 13, color: t.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>{title}</Label>{children}</View>;
}
