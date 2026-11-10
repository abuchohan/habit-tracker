import React, { useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Habit, habitSchema, palette } from '../../shared/domain';
import { Button, Check, Choices, Icon, Input, type InputHandle, Label, Sheet, useTheme } from './ui';
import { foregroundOn } from './design';
import { saveHabit } from './store';

export function HabitEditor({ habit, isNew, onClose }: { habit: Habit; isNew: boolean; onClose: () => void }) {
  const t = useTheme();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<InputHandle>(null), targetRef = useRef<InputHandle>(null), numeratorRef = useRef<InputHandle>(null), denominatorRef = useRef<InputHandle>(null);
  const [draft, setDraft] = useState(habit), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [num, setNum] = useState(String(habit.numerator)), [den, setDen] = useState(String(habit.denominator)), [target, setTarget] = useState(String(habit.target));
  const field = <K extends keyof Habit>(name: K, value: Habit[K]) => setDraft(d => ({ ...d, [name]: value }));
  async function save() {
    const parsed = habitSchema.safeParse({ ...draft, numerator: Number(num), denominator: Number(den), target: Number(target) });
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.path[0] === 'name' ? 'Enter a name for this habit.' : issue.message])));
      setError('Check the highlighted fields before saving.');
      const refs: Record<string, React.RefObject<InputHandle | null>> = { name: nameRef, target: targetRef, numerator: numeratorRef, denominator: denominatorRef };
      refs[String(parsed.error.issues[0].path[0])]?.current?.focus(); return;
    }
    setFieldErrors({}); setError('');
    setBusy(true); try { await saveHabit(parsed.data); onClose(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); }
  }
  return <Sheet title={isNew ? 'New habit' : 'Edit habit'} onClose={onClose}>
    <Input label="Name" inputRef={nameRef} error={fieldErrors.name} autoFocus value={draft.name} placeholder="e.g. Read books" onChangeText={v => field('name', v)} maxLength={120} />
    <Input label="Question (optional)" value={draft.question} placeholder="e.g. Did you read today?" onChangeText={v => field('question', v)} maxLength={500} />
    <View style={{ gap: 10 }}><Label muted>Colour</Label><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{palette.map(color =>
      <Pressable key={color} accessibilityRole="radio" accessibilityLabel={`Colour ${color}`} accessibilityState={{ checked: draft.color === color }} aria-checked={draft.color === color} onPress={() => field('color', color)}
        style={({ pressed }) => ({ width: 44, height: 44, backgroundColor: color, borderRadius: 14, borderWidth: 2, borderColor: draft.color === color ? t.text : 'transparent', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.65 : 1 })}>
        {draft.color === color && <Icon name="check" color={foregroundOn(color)} />}</Pressable>)}</View></View>
    <View style={{ gap: 8 }}><Label style={{ fontSize: 14, fontWeight: '500' }}>Tracking type</Label><Choices value={draft.type} options={[["boolean", 'Yes or no'], ['number', 'Measurable']]} onChange={v => field('type', v)} /></View>
    {draft.type === 'number' && <>
      <Choices value={draft.targetType} options={[["atLeast", 'At least'], ['atMost', 'At most']]} onChange={v => field('targetType', v)} />
      <Input label="Target" inputRef={targetRef} error={fieldErrors.target} keyboardType="decimal-pad" value={target} onChangeText={setTarget} />
      <Input label="Unit" value={draft.unit} onChangeText={v => field('unit', v)} placeholder="e.g. pages" maxLength={40} />
    </>}
    <View style={{ gap: 10 }}><Label muted>Frequency</Label>
      <Choices value={den === '1' ? 'daily' : den === '7' ? 'weekly' : den === '30' ? 'monthly' : 'custom'} options={[["daily", 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['custom', 'Custom']]}
        onChange={v => { setDen(v === 'daily' ? '1' : v === 'weekly' ? '7' : v === 'monthly' ? '30' : '2'); setNum('1'); }} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {draft.type === 'boolean' && <View style={{ flex: 1 }}><Input label="Repetitions" inputRef={numeratorRef} error={fieldErrors.numerator} keyboardType="number-pad" value={num} onChangeText={setNum} /></View>}
        <View style={{ flex: 1 }}><Input label={draft.type === 'number' ? 'Target per this many days' : 'In this many days'} inputRef={denominatorRef} error={fieldErrors.denominator} keyboardType="number-pad" value={den} onChangeText={setDen} /></View>
      </View>
    </View>
    <Input label="Category (optional)" value={draft.category} onChangeText={v => field('category', v)} maxLength={100} />
    <Input label="Description (optional)" multiline value={draft.description} onChangeText={v => field('description', v)} maxLength={4000} />
    {!isNew && <Check label="Archived" detail="Keep history and hide from the active list" value={draft.archived} onChange={v => field('archived', v)} />}
    {!!error && <Label accessibilityRole="alert" style={{ color: t.danger }}>{error}</Label>}
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}><Button onPress={onClose}>Cancel</Button><Button primary disabled={busy} onPress={save}>{busy ? 'Saving…' : 'Save habit'}</Button></View>
  </Sheet>;
}
