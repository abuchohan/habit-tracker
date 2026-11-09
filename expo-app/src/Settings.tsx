import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import { backupSchema, csv, HabitRecord } from '../../shared/domain';
import { backup, importBackup, savePreferences, useStore, saveRecords } from './store';
import { Button, Check, Choices, Input, Label, Sheet } from './ui';
import { download, pickFile } from './platform';
export function Settings({ onClose, onAccount }: { onClose: () => void; onAccount: () => void }) {
  const store = useStore(), p = store.preferences, [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ records: HabitRecord[]; text?: string } | null>(null);
  async function run(fn: () => Promise<void>) { setBusy(true); setError(''); setMessage(''); try { await fn(); } catch(e) { setError(e instanceof Error ? e.message : 'Operation failed.'); } finally { setBusy(false); } }
  const pref = (change: Partial<typeof p>) => run(() => savePreferences({ ...p, ...change }));
  async function chooseBackup() {
    const f = await pickFile(); if (!f) return;
    if (f.bytes[0] === 83 && f.bytes[1] === 81) {
      const { importLoop } = await import('./sqlite'); const records = await importLoop(f.bytes); setPending({ records });
    } else {
      const text = new TextDecoder().decode(f.bytes); const data = backupSchema.parse(JSON.parse(text)); setPending({ records: data.records, text });
    }
  }
  return <Sheet title="Settings" onClose={onClose}>
    <Label muted style={{ fontWeight: '600' }}>APPEARANCE</Label>
    <Choices value={p.theme} options={[["system", 'System'], ['light', 'Light'], ['dark', 'Dark'], ['black', 'Pure black']]} onChange={theme => pref({ theme })} />
    <Check label="Single tap to toggle" detail="When disabled, tap opens the entry editor." value={p.tapToToggle} onChange={tapToToggle => pref({ tapToToggle })} />
    <Check label="Enable skip days" detail="Toggle again after a checkmark to skip. Skips preserve your score and streak." value={p.skip} onChange={skip => pref({ skip })} />
    <Check label="Show question marks for missing data" value={p.unknown} onChange={unknown => pref({ unknown })} />
    <Check label="Reverse date order" value={p.reverse} onChange={reverse => pref({ reverse })} />
    <Check label="Reduce motion" value={p.reducedMotion} onChange={reducedMotion => pref({ reducedMotion })} />
    <Label muted>First day of the week</Label><Choices value={String(p.firstWeekday)} options={[["1", 'Monday'], ['0', 'Sunday'], ['6', 'Saturday']]} onChange={v => pref({ firstWeekday: Number(v) })} />
    <Check label="Start the day at 3 am" detail="Late-night entries before 3 am count toward the previous day. Uses your device’s local timezone." value={p.dayOffset === 3} onChange={v => pref({ dayOffset: v ? 3 : 0 })} />
    <Label muted style={{ fontWeight: '600' }}>ACCOUNT</Label><Button onPress={onAccount}>{store.account ? store.account.email : 'Connect a sync account'}</Button>
    <Label muted>{store.account ? store.syncStatus : 'Local only · no account required'}</Label>
    <Label muted style={{ fontWeight: '600' }}>BACKUPS & DATA</Label><Label muted>Browser storage belongs to this browser and website address. Export a backup to keep a separate copy of your habits.</Label>
    <Button disabled={busy} onPress={() => run(() => download('habits-backup.json', backup()))}>Export full backup</Button>
    <Button disabled={busy} onPress={() => run(() => download('habits.csv', csv(store.records), 'text/csv'))}>Export CSV</Button>
    {Platform.OS === 'web' && <Button disabled={busy} onPress={() => run(async () => { const { exportLoop } = await import('./sqlite'); await download('habits-loop.db', await exportLoop(store.records), 'application/vnd.sqlite3'); })}>Export Loop database</Button>}
    <Button disabled={busy} onPress={() => run(chooseBackup)}>Import backup{Platform.OS === 'web' ? ' / Loop database' : ''}</Button>
    <Label muted style={{ fontWeight: '600' }}>ABOUT</Label><Label>Habits · Web & Expo edition</Label>
    <Label muted>Based on Loop Habit Tracker by Álinson Santos Xavier and contributors. Licensed under GPL-3.0-or-later.</Label>
    <Label muted>Reminders and native home-screen widgets are planned for the iOS version.</Label>
    {!!error && <Label style={{ color: '#d32f2f' }}>{error}</Label>}{!!message && <Label>{message}</Label>}
    {pending && <Sheet title="Import this backup?" onClose={() => setPending(null)}><Label>{pending.records.filter(r => r.kind === 'habit' && !r.deleted).length} habits and {pending.records.filter(r => r.kind === 'entry' && !r.deleted).length} entries.</Label>
      <Label muted>Imported data will merge with your current habits. Matching identifiers will be updated from the backup. Export your current backup first if you need to undo this.</Label>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Button onPress={() => setPending(null)}>Cancel</Button><Button primary disabled={busy} onPress={() => run(async () => { if (pending.text) await importBackup(pending.text); else await saveRecords(pending.records); setPending(null); setMessage('Backup imported.'); })}>Import</Button></View>
    </Sheet>}
  </Sheet>;
}
