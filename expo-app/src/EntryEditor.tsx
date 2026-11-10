import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { Entry, Habit, day, entryId, dateSchema, formatTime, parseTime } from '../../shared/domain';
import { useStore, saveEntry } from './store';
import { Button, Choices, Input, type InputHandle, Label, Sheet, useTheme } from './ui';
export function EntryEditor({ habit, date: initialDate, onClose }: { habit: Habit; date: string; onClose: () => void }) {
  const t = useTheme();
  const store = useStore(), existing = store.records.find((r): r is Entry => r.kind === 'entry' && r.id === entryId(habit.id, initialDate) && !r.deleted);
  const [date, setDate] = useState(initialDate), [status, setStatus] = useState<Entry['state']>(existing?.state ?? 'unknown');
  const [value, setValue] = useState(existing?.value?.toString() ?? ''), [notes, setNotes] = useState(existing?.notes ?? ''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [time, setTime] = useState(existing?.time ? formatTime(existing.time, habit.timeFormat).split(' ')[0] : '');
  const [period, setPeriod] = useState<'AM' | 'PM'>(Number(existing?.time?.slice(0, 2) ?? 0) < 12 ? 'AM' : 'PM');
  const [timeError, setTimeError] = useState(''), timeRef = useRef<InputHandle>(null);
  function setClock(clock: string | null | undefined) {
    setTime(clock ? formatTime(clock, habit.timeFormat).split(' ')[0] : '');
    setPeriod(Number(clock?.slice(0, 2) ?? 0) < 12 ? 'AM' : 'PM');
    setTimeError('');
  }
  async function save() {
    if (!dateSchema.safeParse(date).success || date > day(new Date(), store.preferences.dayOffset)) { setError('Use a valid date, today or earlier (YYYY-MM-DD).'); return; }
    const number = habit.type === 'number' && value.trim() !== '' ? Number(value) : null;
    if (number !== null && (!Number.isFinite(number) || number < 0 || number > 1e9)) { setError('Enter a non-negative number.'); return; }
    const recordedTime = habit.type === 'time' && status === 'yes' ? parseTime(time, habit.timeFormat, period) : null;
    if (habit.type === 'time' && status === 'yes' && !recordedTime) {
      setTimeError(habit.timeFormat === '24h' ? 'Enter a time from 00:00 to 23:59.' : 'Enter a time from 1:00 to 12:59 and choose AM or PM.');
      timeRef.current?.focus(); return;
    }
    setBusy(true);
    try { await saveEntry(habit.id, date, { state: habit.type === 'number' && status !== 'skip' ? number === null ? 'unknown' : 'yes' : status, value: status === 'skip' ? null : number, time: habit.type === 'time' ? recordedTime : undefined, notes }); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); }
  }
  return <Sheet title={habit.name} onClose={onClose}>
    {!!habit.question && <Label>{habit.question}</Label>}
    <Input label="Date (YYYY-MM-DD)" value={date} onChangeText={v => { setDate(v); const e = store.records.find((r): r is Entry => r.kind === 'entry' && r.id === entryId(habit.id, v) && !r.deleted); setStatus(e?.state ?? 'unknown'); setValue(e?.value?.toString() ?? ''); setClock(e?.time); setNotes(e?.notes ?? ''); }} />
    {habit.type === 'time' && <View style={{ gap: 12 }}>
      <Input label={habit.timeFormat === '24h' ? 'Time (HH:mm)' : 'Time (hh:mm)'} inputRef={timeRef} error={timeError} value={time} placeholder={habit.timeFormat === '24h' ? '09:30' : '9:30'} maxLength={5} autoCapitalize="none" onChangeText={v => { setTime(v); setTimeError(''); if (v.trim()) setStatus('yes'); }} />
      {habit.timeFormat === '12h' && <Choices value={period} options={[["AM", 'AM'], ['PM', 'PM']]} onChange={setPeriod} />}
      <Button onPress={() => { const now = new Date(); setClock(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`); setStatus('yes'); }}>Use current time</Button>
    </View>}
    {habit.type !== 'number' ? <Choices value={status} options={[["yes", 'Done'], ['no', 'Missed'], ['skip', 'Skip'], ['unknown', 'Clear']]} onChange={v => { setStatus(v); setTimeError(''); }} /> : <>
      <Input label={habit.unit ? `Value (${habit.unit})` : 'Value'} keyboardType="decimal-pad" value={value} onChangeText={setValue} />
      <Choices value={status === 'skip' ? 'skip' : 'value'} options={[["value", 'Record value'], ['skip', 'Skip']]} onChange={v => setStatus(v === 'skip' ? 'skip' : 'yes')} />
    </>}
    <Input label="Notes (optional)" multiline value={notes} onChangeText={setNotes} maxLength={4000} />
    {!!error && <Label accessibilityRole="alert" style={{ color: t.danger }}>{error}</Label>}
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}><Button onPress={onClose}>Cancel</Button><Button primary disabled={busy} onPress={save}>{busy ? 'Saving…' : 'Save entry'}</Button></View>
  </Sheet>;
}
