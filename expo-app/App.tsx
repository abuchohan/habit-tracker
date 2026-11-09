import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View, ViewStyle, useColorScheme, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Habit, Entry, addDays, computeHistory, day, entriesFor, entryId, newHabit } from '../shared/domain';
import { initialize, useStore, saveEntry, saveRecords, reportError, clearError, sync } from './src/store';
import { Button, Choices, Input, Label, Sheet, Theme, dark, light } from './src/ui';
import { HabitEditor } from './src/HabitEditor';
import { EntryEditor } from './src/EntryEditor';
import { HabitDetail, Ring } from './src/HabitDetail';
import { Settings } from './src/Settings';
import { Account } from './src/Account';
import { installOffline, watchConnectivity, resetToken } from './src/platform';
import { useDateNavigation } from './src/useDateNavigation';

export default function App() {
  const store = useStore(), scheme = useColorScheme(), { width } = useWindowDimensions();
  const [selected, setSelected] = useState<string | null>(null), [editor, setEditor] = useState<{ habit: Habit; isNew: boolean } | null>(null);
  const [entry, setEntry] = useState<{ habit: Habit; date: string } | null>(null), [settings, setSettings] = useState(false), [account, setAccount] = useState(false);
  const [filters, setFilters] = useState(false), [query, setQuery] = useState(''), [archive, setArchive] = useState('active'), [type, setType] = useState('all'), [completion, setCompletion] = useState('all'), [sort, setSort] = useState('manual');
  const [offset, setOffset] = useState(0), [reordering, setReordering] = useState(false), [now, setNow] = useState(new Date()), [token] = useState(() => resetToken());
  const [category, setCategory] = useState('');
  const t = store.preferences.theme === 'dark' || store.preferences.theme === 'black' || store.preferences.theme === 'system' && scheme === 'dark' ? { ...dark, ...(store.preferences.theme === 'black' ? { bg: '#000000', card: '#111111', header: '#111111' } : {}) } : light;
  const today = day(now, store.preferences.dayOffset), mobile = width < 650, cellWidth = mobile ? 44 : 50;
  const count = Math.max(3, Math.min(31, Math.floor((width - (mobile ? 150 : 310)) / cellWidth)));
  const navigation = useDateNavigation({ offset, cellWidth, reverse: store.preferences.reverse, onOffsetChange: setOffset });
  const todayStyle: ViewStyle = { backgroundColor: t.accent + '1a', borderLeftWidth: 1, borderRightWidth: 1, borderColor: t.accent + '44' };
  const dates = Array.from({ length: count }, (_, i) => addDays(today, -(offset + i)));
  if (store.preferences.reverse) dates.reverse();
  useEffect(() => {
    initialize(); installOffline(); const stop = watchConnectivity(() => { setNow(new Date()); void sync(); });
    const timer = setInterval(() => { setNow(new Date()); void sync(); }, 30000);
    return () => { stop(); clearInterval(timer); };
  }, []);
  useEffect(() => { if (token) setAccount(true); }, [token]);
  const habits = useMemo(() => store.records.filter((r): r is Habit => r.kind === 'habit' && !r.deleted), [store.records]);
  const computed = useMemo(() => new Map(habits.map(h => [h.id, computeHistory(h, entriesFor(store.records, h.id), today, store.preferences.firstWeekday)])), [habits, store.records, today, store.preferences.firstWeekday]);
  const list = habits.filter(h => (!category || h.category === category) && (archive === 'all' || h.archived === (archive === 'archived')) && (type === 'all' || h.type === type) && h.name.toLowerCase().includes(query.toLowerCase()) &&
    (completion === 'all' || Boolean(computed.get(h.id)?.find(e => e.date === today)?.completed) === (completion === 'done'))).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'color' ? a.color.localeCompare(b.color) || a.order - b.order : sort === 'score' ? (computed.get(b.id)?.at(-1)?.score ?? 0) - (computed.get(a.id)?.at(-1)?.score ?? 0) : a.order - b.order || a.id.localeCompare(b.id));
  const selectedHabit = habits.find(h => h.id === selected);
  function toggle(h: Habit, date: string) {
    if (h.type === 'number' || !store.preferences.tapToToggle) { setEntry({ habit: h, date }); return; }
    const prev = store.records.find((r): r is Entry => r.kind === 'entry' && r.id === entryId(h.id, date) && !r.deleted);
    const state = prev?.state === 'yes' ? store.preferences.skip ? 'skip' : 'no' : prev?.state === 'skip' ? 'no' : prev?.state === 'no' && store.preferences.unknown ? 'unknown' : 'yes';
    saveEntry(h.id, date, { state, value: null, notes: prev?.notes ?? '' }).catch(reportError);
  }
  async function move(h: Habit, delta: number) {
    const all = [...habits].sort((a,b) => a.order - b.order || a.id.localeCompare(b.id));
    const i = all.findIndex(v => v.id === h.id), other = all[i + delta]; if (!other) return;
    [all[i], all[i + delta]] = [all[i + delta], all[i]];
    // Normalize positions in one write so repeated moves remain deterministic across sync.
    const { version } = await import('../shared/domain');
    await saveRecords(all.map((habit, order) => ({ ...habit, order, version: version(habit.version) })));
  }
  return <Theme.Provider value={t}><View style={{ flex: 1, backgroundColor: t.bg, paddingTop: Platform.OS === 'ios' ? 50 : 0 }}>
    <StatusBar style="light" />
    <View style={{ backgroundColor: t.header, paddingHorizontal: mobile ? 10 : 24, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {selectedHabit && <Button label="Back to habits" onPress={() => setSelected(null)} style={{ marginRight: 8 }}><Text style={{ color: 'white', fontSize: 25 }}>‹</Text></Button>}
      <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, color: '#fff', fontSize: mobile ? 23 : 26, fontWeight: '500' }}>{selectedHabit ? selectedHabit.name : 'Habits'}</Text>
      <Button label="Add habit" disabled={!store.ready} onPress={() => setEditor({ habit: newHabit(Math.max(0, ...habits.map(h => h.order + 1))), isNew: true })}><Text style={{ color: 'white', fontSize: 30, lineHeight: 30 }}>+</Text></Button>
      {!selectedHabit && <Button label="Filter and sort habits" onPress={() => setFilters(true)}><Text style={{ color: 'white', fontSize: 21 }}>☰</Text></Button>}
      <Button label="Settings" onPress={() => setSettings(true)}><Text style={{ color: 'white', fontSize: 23 }}>⋮</Text></Button>
    </View>
    {store.error && <View accessibilityRole="alert" style={{ backgroundColor: t.card, borderBottomWidth: 1, borderColor: '#d32f2f', padding: 12, flexDirection: 'row', alignItems: 'center' }}><Label style={{ flex: 1, color: '#d32f2f' }}>{store.error}</Label><Button onPress={clearError}>Dismiss</Button></View>}
    {!store.ready ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>{store.error ? <Label>Saved data could not be loaded. Reload after checking browser storage permissions.</Label> : <ActivityIndicator color={t.accent} />}</View>
      : selectedHabit ? <ScrollView><HabitDetail habit={selectedHabit} onEdit={() => setEditor({ habit: selectedHabit, isNew: false })} onEntry={date => setEntry({ habit: selectedHabit, date })} onClose={() => setSelected(null)} /></ScrollView>
      : <>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: mobile ? 6 : 16, gap: 2, minHeight: 48 }}>
          <Button label="Show earlier dates" onPress={() => setOffset(v => v + count)}>‹</Button><Button disabled={offset === 0} onPress={() => setOffset(0)}>Today</Button>
          <Button label="Show later dates" disabled={offset === 0} onPress={() => setOffset(v => Math.max(0, v - count))}>›</Button>
          <View style={{ flex: 1 }} /><Label muted style={{ fontSize: 12 }}>{new Date(addDays(today, -offset) + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' })}</Label>
        </View>
        {(query || category || archive !== 'active' || type !== 'all' || completion !== 'all') && <View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}><Label muted style={{ flex: 1, fontSize: 12 }}>{list.length} matching habits{archive === 'archived' ? ' · Archived' : ''}{query ? ` · “${query}”` : ''}{category ? ` · ${category}` : ''}</Label><Button onPress={() => { setQuery(''); setCategory(''); setArchive('active'); setType('all'); setCompletion('all'); }}>Reset</Button></View>}
        <View {...navigation.panHandlers} testID="date-grid" style={[{ flex: 1, minHeight: 0 }, Platform.OS === 'web' && { touchAction: 'pan-y pinch-zoom', userSelect: 'none', cursor: navigation.isDragging ? 'grabbing' : 'grab' } as unknown as ViewStyle]}>
        <View style={{ flexDirection: 'row', paddingHorizontal: mobile ? 3 : 10, borderBottomWidth: 1, borderColor: t.line }}><View style={{ flex: 1, justifyContent: 'center' }}>{reordering && <Label muted style={{ fontSize: 12 }}>Reorder habits</Label>}</View>
          {dates.map((date, column) => <View key={column} testID={`date-header-${date}`} accessibilityLabel={date === today ? `${date}, today` : date} style={[{ width: cellWidth, alignItems: 'center', paddingVertical: 6 }, date === today && todayStyle]}><Label muted style={{ fontSize: 10, fontWeight: '600', color: date === today ? t.accent : t.muted }}>{new Date(date + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' }).toUpperCase()}</Label><Label muted style={{ fontSize: 13, color: date === today ? t.accent : t.muted }}>{Number(date.slice(8))}</Label></View>)}</View>
        <ScrollView testID="habit-list" contentContainerStyle={{ paddingHorizontal: mobile ? 3 : 10, paddingTop: 3, paddingBottom: 30, gap: 3 }}>
          {list.map(h => {
            const history = computed.get(h.id)!, byDate = new Map(history.map(e => [e.date, e]));
            return <View key={h.id} style={{ flexDirection: 'row', minHeight: mobile ? 69 : 74, backgroundColor: t.card, borderBottomWidth: 1, borderColor: t.line, alignItems: 'stretch' }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`View ${h.name}`} onPress={() => { if (!navigation.suppressPress()) setSelected(h.id); }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: mobile ? 8 : 14, paddingLeft: mobile ? 10 : 18, paddingRight: 4 }}>
                <Ring color={h.color} value={history.at(-1)?.score ?? 0} size={mobile ? 18 : 24} /><View style={{ flex: 1 }}><Text numberOfLines={2} style={{ color: h.color, fontSize: mobile ? 15 : 18 }}>{h.name}</Text>{!mobile && h.archived && <Label muted style={{ fontSize: 11 }}>Archived</Label>}</View>
              </Pressable>
              {reordering && <View style={{ justifyContent: 'center' }}><Pressable accessibilityRole="button" accessibilityLabel={`Move ${h.name} up`} onPress={() => move(h, -1).catch(reportError)} style={{ padding: 5 }}><Label>↑</Label></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Move ${h.name} down`} onPress={() => move(h, 1).catch(reportError)} style={{ padding: 5 }}><Label>↓</Label></Pressable></View>}
              {dates.map((date, column) => {
                const e = byDate.get(date), state = e?.state ?? 'unknown', number = e?.value;
                const color = state === 'yes' || h.type === 'number' && e?.completed ? h.color : state === 'auto' || state === 'skip' ? t.muted : t.faint;
                return <Pressable key={column} accessibilityRole="button" accessibilityLabel={`${h.name}, ${date}, ${h.type === 'number' && number !== null && number !== undefined ? `${number} ${h.unit}` : state}`} onPress={() => { if (!navigation.suppressPress()) toggle(h, date); }} onLongPress={() => { if (!navigation.suppressPress()) setEntry({ habit: h, date }); }}
                  style={({ pressed }) => [{ width: cellWidth, justifyContent: 'center', alignItems: 'center' }, date === today && todayStyle, pressed && !navigation.isDragging && { backgroundColor: t.bg }]}>
                  {h.type === 'number' && state !== 'skip' ? <><Text numberOfLines={1} style={{ color, fontSize: 17, fontWeight: '600' }}>{number === null || number === undefined ? store.preferences.unknown ? '?' : '–' : Number(number.toFixed(3))}</Text><Text numberOfLines={1} style={{ color, fontSize: 10, paddingTop: 2 }}>{h.unit}</Text></> : <Text style={{ color, fontSize: state === 'auto' ? 19 : 25, fontWeight: '700' }}>{state === 'yes' ? '✓' : state === 'auto' ? '✓' : state === 'skip' ? '–' : state === 'unknown' && store.preferences.unknown ? '?' : '×'}</Text>}
                  {!!e?.notes && <View style={{ position: 'absolute', bottom: 8, width: 3, height: 3, borderRadius: 2, backgroundColor: t.muted }} />}
                </Pressable>;
              })}
            </View>;
          })}
          {!list.length && <View style={{ alignItems: 'center', padding: 40, paddingTop: 70, gap: 12 }}><Label style={{ fontSize: 21 }}>{habits.length ? 'No matching habits' : 'Build a habit, one day at a time.'}</Label><Label muted style={{ textAlign: 'center' }}>{habits.length ? 'Try changing the filters.' : 'Add your first habit to start tracking. No account needed.'}</Label>
            {!habits.length && <Button primary onPress={() => setEditor({ habit: newHabit(), isNew: true })}>Add your first habit</Button>}</View>}
        </ScrollView>
        </View>
      </>}
    <Pressable accessibilityRole="button" accessibilityLabel="Account and sync status" onPress={() => setAccount(true)} style={{ paddingVertical: 8, paddingHorizontal: 18, backgroundColor: t.card, borderTopWidth: 1, borderColor: t.line, flexDirection: 'row', justifyContent: 'space-between' }}>
      <Label muted style={{ fontSize: 11 }}>{store.account ? store.syncStatus : 'Local only · saved on this device'}</Label><Label muted style={{ fontSize: 11 }}>{store.account ? 'Account' : 'Connect sync'}</Label>
    </Pressable>
    {filters && <Sheet title="Filter & sort" onClose={() => setFilters(false)}><Input label="Search habits" value={query} onChangeText={setQuery} placeholder="Habit name" /><Label muted>Show</Label><Choices value={archive} options={[["active", 'Active'], ['archived', 'Archived'], ['all', 'All']]} onChange={setArchive} />
      <Choices value={type} options={[["all", 'All types'], ['boolean', 'Yes / no'], ['number', 'Measurable']]} onChange={setType} />
      <Choices value={completion} options={[["all", 'All progress'], ['done', 'Completed today'], ['pending', 'Not completed']]} onChange={setCompletion} />
      <Label muted>Sort by</Label><Choices value={sort} options={[["manual", 'My order'], ['name', 'Name'], ['color', 'Colour'], ['score', 'Strength']]} onChange={v => { setSort(v); if (v !== 'manual') setReordering(false); }} />
      {habits.some(h => h.category) && <><Label muted>Category</Label><Choices value={category} options={[["", 'All categories'], ...[...new Set(habits.map(h => h.category).filter(Boolean))].map(c => [c, c] as [string, string])]} onChange={setCategory} /></>}
      <Button onPress={() => { setSort('manual'); setReordering(v => !v); setFilters(false); }}>{reordering ? 'Finish reordering' : 'Reorder habits'}</Button><Button primary onPress={() => setFilters(false)}>Done</Button></Sheet>}
    {settings && <Settings onClose={() => setSettings(false)} onAccount={() => { setSettings(false); setAccount(true); }} />}
    {account && <Account onClose={() => setAccount(false)} token={token} />}
    {editor && <HabitEditor habit={editor.habit} isNew={editor.isNew} onClose={() => setEditor(null)} />}
    {entry && <EntryEditor habit={entry.habit} date={entry.date} onClose={() => setEntry(null)} />}
  </View></Theme.Provider>;
}
