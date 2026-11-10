import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import { HabitRecord, Habit, Entry, Preferences, backupSchema, preferencesSchema, savedPreferencesSchema, defaultPreferences, seedPreferences, mergePreferences, mergeRecords, entryId, version, recordSchema } from '../../shared/domain';
import { getItem, setItem, requestPersistence } from './storage';
import { api, ApiError } from './api';

type Account = { id: string; email: string };
type State = { ready: boolean; records: HabitRecord[]; preferences: Preferences; account: Account | null;
  syncing: boolean; syncStatus: string; lastSync: string | null; error: string | null };
let state: State = { ready: false, records: [], preferences: defaultPreferences, account: null, syncing: false, syncStatus: 'Local only', lastSync: null, error: null };
const listeners = new Set<() => void>();
function emit(change: Partial<State>) { state = { ...state, ...change }; listeners.forEach(fn => fn()); }
export function useStore() { return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => state); }
export function getState() { return state; }
let operations: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const result = operations.then(fn); operations = result.catch(() => {}); return result;
}
const key = (account: Account | null) => `records:${account?.id ?? 'guest'}`;
const preferencesKey = (account: Account | null) => `preferences:${account?.id ?? 'guest'}`;
let savedPreferences = seedPreferences(defaultPreferences);
async function readPreferences(account: Account | null, fallback = defaultPreferences) {
  const raw = await getItem(preferencesKey(account));
  return raw ? savedPreferencesSchema.parse(JSON.parse(raw)) : seedPreferences(fallback);
}
async function readRecords(account: Account | null) {
  const raw = await getItem(key(account));
  return raw ? z.array(recordSchema).parse(JSON.parse(raw)) : [];
}
let startup: Promise<void> | undefined;
export function initialize() {
  return startup ??= (async () => {
    try {
      const rawAccount = await getItem('account');
      const account = rawAccount ? z.object({ id: z.string(), email: z.string().email() }).nullable().parse(JSON.parse(rawAccount)) : null;
      const rawPreferences = await getItem('preferences');
      const legacy = rawPreferences ? preferencesSchema.parse(JSON.parse(rawPreferences)) : defaultPreferences;
      // Keep the old device-wide settings when upgrading to separate guest/account caches.
      savedPreferences = await readPreferences(account, legacy);
      if (account && !await getItem(preferencesKey(null))) {
        await setItem(preferencesKey(null), JSON.stringify(seedPreferences(legacy)));
      }
      await setItem(preferencesKey(account), JSON.stringify(savedPreferences));
      const records = await readRecords(account);
      emit({ ready: true, account, records, preferences: savedPreferences.values, syncStatus: account ? 'Waiting to sync' : 'Local only' });
      requestPersistence();
      if (account) void sync();
    } catch (error) { emit({ error: `Could not open saved data: ${error instanceof Error ? error.message : 'Storage unavailable'}` }); }
  })();
}
export function saveRecords(incoming: HabitRecord[]) {
  return serial(async () => {
    const records = mergeRecords(state.records, incoming.map(r => recordSchema.parse(r)));
    await setItem(key(state.account), JSON.stringify(records));
    emit({ records, error: null });
  }).then(() => { if (state.account) void sync(); });
}
export async function saveHabit(habit: Habit) {
  await saveRecords([{ ...habit, version: version(state.records.find(r => r.id === habit.id)?.version) }]);
}
export function saveEntry(habitId: string, date: string, fields: Pick<Entry, 'state' | 'value' | 'notes' | 'time'>) {
  const id = entryId(habitId, date);
  const prev = state.records.find(r => r.id === id);
  return saveRecords([{ id, kind: 'entry', habitId, date, deleted: false, version: version(prev?.version), ...fields }]);
}
export function savePreferences(preferences: Preferences) {
  return serial(async () => {
    const parsed = preferencesSchema.parse(preferences);
    const next = { version: version(savedPreferences.version), values: parsed };
    await setItem(preferencesKey(state.account), JSON.stringify(next));
    savedPreferences = next;
    emit({ preferences: parsed });
  }).then(() => { if (state.account) void sync(); });
}
let syncing: Promise<void> | null = null;
let syncAgain = false;
export function sync(): Promise<void> {
  if (!state.account) return Promise.resolve();
  if (syncing) { syncAgain = true; return syncing; }
  syncing = (async () => {
    const account = state.account!;
    emit({ syncing: true, syncStatus: 'Syncing…' });
    try {
      const result = await api<{ user: Account }>('/auth/me');
      if (result.user.id !== account.id) throw new Error('Sign in again to sync this account.');
      await operations;
      const outgoing = [...state.records];
      const outgoingPreferences = savedPreferences;
      for (let i = 0; i < Math.max(outgoing.length, 1); i += 500) {
        const response = await api<{ records: unknown[]; preferences?: unknown }>('/sync', { records: outgoing.slice(i, i + 500), preferences: outgoingPreferences });
        const remote = z.array(recordSchema).parse(response.records);
        const remotePreferences = savedPreferencesSchema.nullish().parse(response.preferences) ?? null;
        await serial(async () => {
          if (state.account?.id !== account.id) return;
          const records = mergeRecords(state.records, remote);
          const preferences = mergePreferences(savedPreferences, remotePreferences);
          await setItem(key(account), JSON.stringify(records));
          await setItem(preferencesKey(account), JSON.stringify(preferences));
          savedPreferences = preferences;
          emit({ records, preferences: preferences.values });
        });
      }
      emit({ lastSync: new Date().toISOString(), syncStatus: 'Synced' });
    } catch (error) {
      emit({ syncStatus: error instanceof ApiError && error.status === 401 ? 'Sign in again to sync' : error instanceof Error && error.message.includes('Sign in') ? error.message : 'Offline · changes saved on this device' });
    } finally {
      emit({ syncing: false }); syncing = null;
      if (syncAgain) { syncAgain = false; setTimeout(() => { void sync(); }, 250); }
    }
  })();
  return syncing;
}
export async function connect(email: string, password: string, register: boolean, includeLocal: boolean) {
  if (register) await api('/auth/register', { email, password });
  const { user } = await api<{ user: Account }>('/auth/login', { email, password });
  await serial(async () => {
    const local = await readRecords(user);
    const guest = includeLocal && !state.account ? state.records : [];
    const records = mergeRecords(local, guest);
    const preferences = await readPreferences(user, state.preferences);
    await setItem(key(user), JSON.stringify(records));
    await setItem('account', JSON.stringify(user));
    await setItem(preferencesKey(user), JSON.stringify(preferences));
    savedPreferences = preferences;
    emit({ account: user, records, preferences: preferences.values, syncStatus: 'Waiting to sync', lastSync: null });
  });
  await sync();
}
export async function disconnect() {
  if (syncing) await syncing;
  await api('/auth/logout', {});
  await serial(async () => {
    const records = await readRecords(null);
    const preferences = await readPreferences(null);
    await setItem('account', 'null');
    savedPreferences = preferences;
    emit({ account: null, records, preferences: preferences.values, lastSync: null, syncStatus: 'Local only' });
  });
}
export function backup() { return JSON.stringify({ format: 'loop-web', version: 1, records: state.records, preferences: state.preferences }, null, 2); }
export async function importBackup(text: string) {
  const parsed = backupSchema.parse(JSON.parse(text));
  // Restoring intentionally becomes a new edit so it is propagated to connected devices.
  const records = parsed.records.map(r => ({ ...r, version: version(state.records.find(v => v.id === r.id)?.version) }));
  await saveRecords(records);
  if (parsed.preferences) await savePreferences(parsed.preferences);
}
export function reportError(error: unknown) { emit({ error: error instanceof Error ? error.message : String(error) }); }
export function clearError() { emit({ error: null }); }
