import React, { createContext, useContext, useId, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, TextInputProps, TextProps, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { face, light, radii, webClass } from './design';
export { light, dark } from './design';
export const Theme = createContext(light);
export const ReducedMotion = createContext(false);
export const useTheme = () => useContext(Theme);
const paths = {
  grip: 'M8 6h1m6 0h1M8 12h1m6 0h1M8 18h1m6 0h1',
  plus: 'M12 5v14M5 12h14', close: 'm6 6 12 12M6 18 18 6', check: 'm5 12 4 4L19 6',
  back: 'm14 6-6 6 6 6', next: 'm10 6 6 6-6 6', arrow: 'M4 12h16m-6-6 6 6-6 6',
  filter: 'M4 7h16M7 12h10M10 17h4', search: 'm16 16 4 4M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  calendar: 'M5 5h14v15H5zM8 3v4m8-4v4M5 10h14', archive: 'M4 4h16v5H4zM6 9v11h12V9M10 13h4',
  settings: 'M4 6h16M4 18h16M8 3v6M16 15v6M4 12h16',
  cloud: 'M7 18a5 5 0 0 1-1-10 6 6 0 0 1 11-1 5.5 5.5 0 0 1 0 11M9 14l3-3 3 3M12 11v10',
  chart: 'M5 20V10m7 10V4m7 16v-7', up: 'M12 20V4m-6 6 6-6 6 6', down: 'M12 4v16m-6-6 6 6 6-6',
  note: 'M5 3h10l4 4v14H5zM9 11h6M9 15h6',
};
export function Icon({ name, size = 20, color }: { name: keyof typeof paths; size?: number; color?: string }) {
  const t = useTheme();
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? t.text} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" accessible={false} aria-hidden><Path d={paths[name]} /></Svg>;
}
export function Mark({ size = 32 }: { size?: number }) {
  const t = useTheme();
  return <Svg width={size} height={size} viewBox="0 0 32 32" accessible={false} aria-hidden><Circle cx={16} cy={16} r={12} fill="none" stroke={t.text} strokeWidth={3} /><Path d="m10 16 4 4 8-9" fill="none" stroke={t.text} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
export function Label({ style, muted = false, ...props }: TextProps & { muted?: boolean }) {
  const t = useTheme(); return <Text {...props} style={[{ fontFamily: face, fontSize: 16, lineHeight: 24, color: muted ? t.muted : t.text }, style]} />;
}
export function Button({ children, onPress, primary = false, danger = false, disabled = false, label, style }: {
  children: React.ReactNode; onPress: () => void; primary?: boolean; danger?: boolean; disabled?: boolean; label?: string; style?: any;
}) {
  const t = useTheme(); return <Pressable ref={webClass(`btn ${primary ? 'btn--primary' : 'btn--secondary'}`)} accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
    accessibilityState={{ disabled }} onPress={onPress} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [{ minHeight: 44, minWidth: 44, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radii.control,
      borderWidth: 1, borderColor: primary ? t.accent : t.line, backgroundColor: primary ? t.accent : hovered ? t.card : t.paper,
      alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }, style]}>
    {typeof children === 'string' || typeof children === 'number' ? <Label style={{ color: primary ? t.onAccent : danger ? t.danger : t.text, fontWeight: '500', fontSize: 14, lineHeight: 22 }}>{children}</Label> : children}
  </Pressable>;
}
export type InputHandle = React.ComponentRef<typeof TextInput>;
export function Input({ label, error, inputRef, ...props }: TextInputProps & { label: string; error?: string; inputRef?: React.Ref<InputHandle> }) {
  const t = useTheme(), id = useId(), [focused, setFocused] = useState(false);
  return <View style={{ gap: 8, flexShrink: 1 }}><Label nativeID={`${id}-label`} style={{ fontSize: 14, fontWeight: '500' }}>{label}</Label>
    <TextInput {...props} ref={inputRef} accessibilityLabel={label} aria-labelledby={`${id}-label`} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
      placeholderTextColor={t.muted} onFocus={event => { setFocused(true); props.onFocus?.(event); }} onBlur={event => { setFocused(false); props.onBlur?.(event); }}
      style={[{ backgroundColor: t.paper, borderWidth: 1, borderColor: error ? t.danger : focused ? t.accent : t.line, borderRadius: radii.control,
        minHeight: props.multiline ? 96 : 48, padding: 12, color: t.text, fontFamily: face, fontSize: 16, textAlignVertical: props.multiline ? 'top' : 'center' }, props.style]} />
    {!!error && <Label nativeID={`${id}-error`} accessibilityRole="alert" style={{ color: t.danger, fontSize: 14 }}>{error}</Label>}
  </View>;
}
export function Check({ label, value, onChange, detail }: { label: string; value: boolean; onChange: (v: boolean) => void; detail?: string }) {
  const t = useTheme(); return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: value }} aria-checked={value}
    onPress={() => onChange(!value)} style={({ pressed }) => ({ flexDirection: 'row', gap: 12, paddingVertical: 12, minHeight: 48, alignItems: 'center', opacity: pressed ? 0.65 : 1 })}>
    <View style={{ width: 24, height: 24, borderWidth: 1, borderColor: value ? t.accent : t.muted, borderRadius: 7, backgroundColor: value ? t.accent : t.paper, alignItems: 'center', justifyContent: 'center' }}>{value && <Icon name="check" color={t.onAccent} size={18} />}</View>
    <View style={{ flex: 1 }}><Label>{label}</Label>{!!detail && <Label muted style={{ fontSize: 14, lineHeight: 21 }}>{detail}</Label>}</View>
  </Pressable>;
}
export function Choices<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (value: T) => void }) {
  const t = useTheme(); return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{options.map(([id, label]) => <Pressable key={id}
    accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: value === id }} aria-checked={value === id} onPress={() => onChange(id)}
    style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) => ({ borderWidth: 1, borderColor: value === id ? t.text : t.line, backgroundColor: value === id ? t.soft : hovered ? t.card : t.paper,
      borderRadius: radii.control, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.65 : 1 })}>
    <Label style={{ fontSize: 14, fontWeight: value === id ? '500' : '400' }}>{label}</Label></Pressable>)}</View>;
}
export function Sheet({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const t = useTheme(), reduced = useContext(ReducedMotion);
  return <Modal visible transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#11111199', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <View accessibilityViewIsModal style={{ width: '100%', maxWidth: wide ? 880 : 560, maxHeight: '94%', backgroundColor: t.paper, borderRadius: radii.sheet, borderWidth: 1, borderColor: t.line, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderColor: t.line }}>
          <Label accessibilityRole="header" style={{ flex: 1, fontSize: 24, lineHeight: 32, letterSpacing: -0.6, fontWeight: '500' }}>{title}</Label>
          <Button label="Close dialog" onPress={onClose} style={{ borderWidth: 0, paddingHorizontal: 10 }}><Icon name="close" /></Button>
        </View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 24 }}>{children}</ScrollView>
      </View></KeyboardAvoidingView>
  </Modal>;
}
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme(); return <View style={{ backgroundColor: t.paper, borderWidth: 1, borderColor: t.line, borderRadius: radii.panel, padding: 24, gap: 20 }}>
    <Label accessibilityRole="header" aria-level={2} style={{ fontSize: 20, lineHeight: 28, fontWeight: '500', letterSpacing: -0.4 }}>{title}</Label>{children}</View>;
}
