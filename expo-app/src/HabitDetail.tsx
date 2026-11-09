import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Line, Polyline, Rect, Circle } from 'react-native-svg';
import { Habit, addDays, day, computeHistory, entriesFor, monthLength, schedule, streaks, weekday, csv, uid } from '../../shared/domain';
import { useStore, saveHabit, reportError } from './store';
import { Button, Choices, Label, Section, Sheet, useTheme } from './ui';
import { download } from './platform';

export function Ring({ value, color, size = 22 }: { value: number; color: string; size?: number }) {
  const t = useTheme(), r = 15, circumference = 2 * Math.PI * r;
  return <Svg width={size} height={size} viewBox="0 0 36 36" accessibilityLabel={`Habit strength ${Math.round(value * 100)} percent`}>
    <Circle cx="18" cy="18" r={r} fill="none" stroke={t.line} strokeWidth="5" />
    <Circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="5" strokeDasharray={`${circumference * value} ${circumference}`} transform="rotate(-90 18 18)" />
  </Svg>;
}
export function HabitDetail({ habit: h, onEdit, onEntry, onClose }: { habit: Habit; onEdit: () => void; onEntry: (date: string) => void; onClose: () => void }) {
  const store = useStore(), t = useTheme(), today = day(new Date(), store.preferences.dayOffset);
  const history = useMemo(() => computeHistory(h, entriesFor(store.records, h.id), today, store.preferences.firstWeekday), [store.records, h, today, store.preferences.firstWeekday]);
  const [month, setMonth] = useState(today.slice(0, 7) + '-01'), [confirmDelete, setConfirmDelete] = useState(false), [span, setSpan] = useState('90');
  const current = history[history.length - 1], runs = streaks(history), best = [...runs].sort((a, b) => b.length - a.length).slice(0, 6);
  const streak = runs.length && runs[runs.length - 1].end >= addDays(today, -1) ? runs[runs.length - 1].length : 0;
  const byDate = new Map(history.map(e => [e.date, e]));
  const start = (weekday(month) - store.preferences.firstWeekday + 7) % 7;
  const chart = history.slice(-Number(span)), count = entriesFor(store.records, h.id).filter(e => e.state === 'yes').length;
  const frequency = Array.from({ length: 7 }, (_, i) => { const w = (i + store.preferences.firstWeekday) % 7; return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][w], value: entriesFor(store.records, h.id).filter(e => weekday(e.date) === w && e.state === 'yes').reduce((a, e) => a + (h.type === 'number' ? e.value ?? 0 : 1), 0) }; });
  const maxFrequency = Math.max(1, ...frequency.map(f => f.value));
  const monthly = new Map<string, number>();
  for (const e of entriesFor(store.records, h.id)) if (e.state === 'yes') monthly.set(e.date.slice(0, 7), (monthly.get(e.date.slice(0, 7)) ?? 0) + (h.type === 'number' ? e.value ?? 0 : 1));
  const totals = [...monthly].sort((a,b) => b[0].localeCompare(a[0])).slice(0, 12);
  function changeMonth(delta: number) { const d = new Date(month + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + delta); setMonth(d.toISOString().slice(0, 10)); }
  return <View style={{ gap: 10, padding: 12, maxWidth: 1050, width: '100%', alignSelf: 'center' }}>
    <Section title="Overview">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}><Ring value={current?.score ?? 0} color={h.color} size={60} />
        <View style={{ flex: 1 }}><Label style={{ fontSize: 23, color: h.color }}>{h.name}</Label><Label muted>{schedule(h)}{h.archived ? ' · Archived' : ''}</Label></View></View>
      {!!h.question && <Label>{h.question}</Label>}{!!h.description && <Label muted>{h.description}</Label>}
      {h.type === 'number' && <Label muted>{h.targetType === 'atLeast' ? 'At least' : 'At most'} {h.target} {h.unit} per {h.denominator === 1 ? 'day' : `${h.denominator} days`}</Label>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 28 }}>{[[`${Math.round((current?.score ?? 0) * 100)}%`, 'Strength'], [String(streak), 'Current streak'], [String(best[0]?.length ?? 0), 'Best streak'], [String(count), 'Repetitions']].map(([value, label]) =>
        <View key={label}><Label style={{ fontSize: 24, color: h.color }}>{value}</Label><Label muted style={{ fontSize: 12 }}>{label}</Label></View>)}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}><Button onPress={() => onEntry(today)}>Record today</Button><Button onPress={onEdit}>Edit habit</Button>
        <Button onPress={() => saveHabit({ ...h, archived: !h.archived }).catch(reportError)}>{h.archived ? 'Unarchive' : 'Archive'}</Button>
        <Button onPress={() => saveHabit({ ...h, id: uid(), name: `${h.name} (copy)`.slice(0, 120), archived: false, created: today, order: h.order + 0.5 }).then(onClose).catch(reportError)}>Duplicate</Button>
        <Button onPress={() => download('habit.csv', csv(store.records.filter(r => r.id === h.id || r.kind === 'entry' && r.habitId === h.id)), 'text/csv').catch(reportError)}>Export CSV</Button></View>
    </Section>
    <Section title="Habit strength"><Choices value={span} options={[["30", 'Month'], ['90', 'Quarter'], ['365', 'Year']]} onChange={setSpan} />
      {chart.length ? <><Svg width="100%" height={150} viewBox="0 0 700 150" preserveAspectRatio="none" accessibilityLabel="Habit strength over time">
        {[0, 0.5, 1].map(y => <Line key={y} x1="0" x2="700" y1={140 - y * 130} y2={140 - y * 130} stroke={t.line} />)}
        <Polyline points={chart.map((e, i) => `${chart.length > 1 ? i / (chart.length - 1) * 700 : 350},${140 - e.score * 130}`).join(' ')} fill="none" stroke={h.color} strokeWidth="3" />
      </Svg><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Label muted style={{ fontSize: 12 }}>{chart[0].date}</Label><Label muted style={{ fontSize: 12 }}>{today}</Label></View></> : <Label muted>Your strength graph will appear after your first entry.</Label>}
    </Section>
    {h.type === 'number' && <Section title={`Values · ${h.unit || 'amount'}`}>
      {chart.length ? <Svg width="100%" height={130} viewBox="0 0 700 130" preserveAspectRatio="none" accessibilityLabel="Recorded values over time">
        {chart.map((e, i) => { const max = Math.max(h.target, ...chart.map(v => v.value ?? 0), 1); const height = (e.value ?? 0) / max * 115; return <Rect key={e.date} x={i / chart.length * 700} y={125 - height} width={Math.max(1, 700 / chart.length - 2)} height={height} fill={h.color} />; })}
      </Svg> : <Label muted>No values recorded yet.</Label>}
    </Section>}
    <Section title="History">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Button label="Previous month" onPress={() => changeMonth(-1)}>‹</Button>
        <Label>{new Date(month + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}</Label>
        <Button label="Next month" disabled={month.slice(0, 7) >= today.slice(0, 7)} onPress={() => changeMonth(1)}>›</Button></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{Array.from({ length: 7 }, (_, i) => <View key={`w${i}`} style={{ width: '14.2857%', alignItems: 'center', paddingBottom: 8 }}><Label muted style={{ fontSize: 11 }}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][(i + store.preferences.firstWeekday) % 7]}</Label></View>)}
        {Array.from({ length: start + monthLength(month) }, (_, i) => {
          if (i < start) return <View key={i} style={{ width: '14.2857%' }} />;
          const date = addDays(month, i - start), e = byDate.get(date), future = date > today;
          return <Pressable key={i} disabled={future} accessibilityRole="button" accessibilityLabel={`${date}: ${e?.state ?? 'no data'}${e?.value !== null && e?.value !== undefined ? `, ${e.value} ${h.unit}` : ''}${e?.notes ? ', has note' : ''}`} onPress={() => onEntry(date)}
            style={{ width: '14.2857%', padding: 3 }}><View style={{ minHeight: 48, borderRadius: 3, alignItems: 'center', justifyContent: 'center', opacity: future ? 0.25 : 1,
              backgroundColor: e?.state === 'skip' ? t.line : e?.completed ? h.color + (e.state === 'auto' ? '33' : 'dd') : t.bg,
              borderWidth: date === today ? 1 : 0, borderColor: h.color }}>
              <Label style={{ color: e?.completed && e.state !== 'auto' && e.state !== 'skip' ? '#ffffff' : t.text, fontSize: 13 }}>{Number(date.slice(8))}</Label>
              {e?.notes ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: t.text }} /> : null}
            </View></Pressable>;
        })}</View><Label muted style={{ fontSize: 12 }}>Select any past day to edit its entry or add a note.</Label>
    </Section>
    <Section title="Best streaks">{best.length ? best.map(run => <View key={run.start} style={{ gap: 4 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Label muted style={{ fontSize: 13 }}>{run.start} — {run.end}</Label><Label>{run.length} days</Label></View>
      <View style={{ height: 5, width: `${run.length / best[0].length * 100}%`, backgroundColor: h.color, borderRadius: 2 }} /></View>) : <Label muted>No streaks yet.</Label>}</Section>
    <Section title="Frequency by weekday"><View style={{ flexDirection: 'row', gap: 6, height: 140, alignItems: 'flex-end' }}>{frequency.map(f => <View key={f.day} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Label muted style={{ fontSize: 11 }}>{Number(f.value.toFixed(1))}</Label><View style={{ height: f.value / maxFrequency * 85 + 2, width: '70%', backgroundColor: h.color, borderRadius: 2 }} /><Label muted style={{ fontSize: 11 }}>{f.day}</Label></View>)}</View></Section>
    <Section title="Monthly totals">{totals.length ? totals.map(([month, total]) => <View key={month} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Label muted>{month}</Label><Label>{Number(total.toFixed(3))} {h.type === 'number' ? h.unit : 'times'}</Label></View>) : <Label muted>No repetitions yet.</Label>}</Section>
    <Button danger onPress={() => setConfirmDelete(true)}>Delete habit</Button>
    {confirmDelete && <Sheet title="Delete habit?" onClose={() => setConfirmDelete(false)}><Label>This removes “{h.name}” from your list and syncs its deletion to your connected devices. Export a backup first if you want to keep it.</Label>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Button onPress={() => setConfirmDelete(false)}>Cancel</Button><Button danger onPress={() => saveHabit({ ...h, deleted: true }).then(onClose).catch(reportError)}>Delete habit</Button></View></Sheet>}
  </View>;
}
