import React, { useState } from 'react';
import { View } from 'react-native';
import { Entry, Habit, day, entryId, dateSchema } from '../../shared/domain';
import { useStore, saveEntry } from './store';
import { Button, Choices, Input, Label, Sheet } from './ui';
export function EntryEditor({ habit, date: initialDate, onClose }: { habit: Habit; date: string; onClose: () => void }) {
  const store = useStore(), existing = store.records.find((r): r is Entry => r.kind === 'entry' && r.id === entryId(habit.id, initialDate) && !r.deleted);
  const [date, setDate] = useState(initialDate), [status, setStatus] = useState<Entry['state']>(existing?.state ?? 'unknown');
  const [value, setValue] = useState(existing?.value?.toString() ?? ''), [notes, setNotes] = useState(existing?.notes ?? ''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function save() {
    if (!dateSchema.safeParse(date).success || date > day(new Date(), store.preferences.dayOffset)) { setError('Use a valid date, today or earlier (YYYY-MM-DD).'); return; }
    const number = habit.type === 'number' && value.trim() !== '' ? Number(value) : null;
    if (number !== null && (!Number.isFinite(number) || number < 0 || number > 1e9)) { setError('Enter a non-negative number.'); return; }
    setBusy(true);
    try { await saveEntry(habit.id, date, { state: habit.type === 'number' && status !== 'skip' ? number === null ? 'unknown' : 'yes' : status, value: status === 'skip' ? null : number, notes }); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); }
  }
  return <Sheet title={habit.name} onClose={onClose}>
    {!!habit.question && <Label>{habit.question}</Label>}
    <Input label="Date (YYYY-MM-DD)" value={date} onChangeText={v => { setDate(v); const e = store.records.find((r): r is Entry => r.kind === 'entry' && r.id === entryId(habit.id, v) && !r.deleted); setStatus(e?.state ?? 'unknown'); setValue(e?.value?.toString() ?? ''); setNotes(e?.notes ?? ''); }} />
    {habit.type === 'boolean' ? <Choices value={status} options={[["yes", 'Done'], ['no', 'Missed'], ['skip', 'Skip'], ['unknown', 'Clear']]} onChange={setStatus} /> : <>
      <Input label={habit.unit ? `Value (${habit.unit})` : 'Value'} keyboardType="decimal-pad" value={value} onChangeText={setValue} />
      <Choices value={status === 'skip' ? 'skip' : 'value'} options={[["value", 'Record value'], ['skip', 'Skip']]} onChange={v => setStatus(v === 'skip' ? 'skip' : 'yes')} />
    </>}
    <Input label="Notes (optional)" multiline value={notes} onChangeText={setNotes} maxLength={4000} />
    {!!error && <Label style={{ color: '#d32f2f' }}>{error}</Label>}
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}><Button onPress={onClose}>Cancel</Button><Button primary disabled={busy} onPress={save}>{busy ? 'Saving…' : 'Save entry'}</Button></View>
  </Sheet>;
}
