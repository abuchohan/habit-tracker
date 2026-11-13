import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import { HabitRecord, Habit, Entry, Preferences, backupSchema, preferencesSchema, savedPreferencesSchema, defaultPreferences, seedPreferences, mergePreferences, mergeRecords, entryId, version, recordSchema, reorderHabitRecords } from '../../shared/domain';
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
let editRevision = 0;
let syncTimer: ReturnType<typeof setTimeout> | undefined;
let batchStartedAt: number | undefined;
let retryAt = 0;
let failures = 0;
let sessionInvalid = false;
let syncedAccountId: string | null = null;
const syncedVersions = new Map<string, string>();
let syncedPreferencesVersion: string | undefined;
function clearSyncTimer() {
  clearTimeout(syncTimer);
  syncTimer = undefined;
  batchStartedAt = undefined;
}
function scheduleSync() {
  if (!state.account || sessionInvalid) return;
  const now = Date.now();
  batchStartedAt ??= now;
  clearTimeout(syncTimer);
  // Save immediately on-device; upload after a quiet period, or at least every 10s.
  const delay = Math.max(retryAt - now, Math.min(2000, batchStartedAt + 10000 - now), 0);
  syncTimer = setTimeout(() => { clearSyncTimer(); void sync(); }, delay);
}
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
    editRevision++;
    emit({ records, error: null });
  }).then(scheduleSync);
}
export async function saveHabit(habit: Habit) {
  await saveRecords([{ ...habit, version: version(state.records.find(r => r.id === habit.id)?.version) }]);
}
export function reorderHabits(habitId: string, targetId: string, visibleIds: string[]) {
  return serial(async () => {
    // Compute inside the queue so rapid moves use the latest saved records.
    const changes = reorderHabitRecords(state.records, habitId, targetId, visibleIds);
    if (!changes.length) return;
    const records = mergeRecords(state.records, changes);
    await setItem(key(state.account), JSON.stringify(records));
    editRevision++;
    emit({ records, error: null });
  }).then(scheduleSync);
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
    editRevision++;
    emit({ preferences: parsed });
  }).then(scheduleSync);
}
let syncing: Promise<void> | null = null;
export function sync(): Promise<void> {
  if (!state.account || sessionInvalid) return Promise.resolve();
  if (syncing) return syncing;
  if (Date.now() < retryAt) { scheduleSync(); return Promise.resolve(); }
  clearSyncTimer();
  syncing = (async () => {
    const account = state.account!;
    let revision = editRevision;
    emit({ syncing: true, syncStatus: 'Syncing…' });
    try {
      await operations;
      if (state.account?.id !== account.id) return;
      clearSyncTimer();
      if (syncedAccountId !== account.id) {
        syncedAccountId = account.id;
        syncedVersions.clear();
        syncedPreferencesVersion = undefined;
      }
      revision = editRevision;
      const outgoing = state.records.filter(record => syncedVersions.get(record.id) !== record.version);
      const outgoingPreferences = savedPreferences;
      for (let i = 0; i < Math.max(outgoing.length, 1); i += 500) {
        const response = await api<{ records: unknown[]; preferences?: unknown }>('/sync', {
          accountId: account.id,
          records: outgoing.slice(i, i + 500),
          ...(syncedPreferencesVersion === outgoingPreferences.version ? {} : { preferences: outgoingPreferences }),
        });
        const remote = z.array(recordSchema).parse(response.records);
        const remotePreferences = savedPreferencesSchema.nullish().parse(response.preferences) ?? null;
        await serial(async () => {
          if (state.account?.id !== account.id) return;
          const records = mergeRecords(state.records, remote);
          const preferences = mergePreferences(savedPreferences, remotePreferences);
          await setItem(key(account), JSON.stringify(records));
          await setItem(preferencesKey(account), JSON.stringify(preferences));
          savedPreferences = preferences;
          // Only acknowledge server versions; edits made during this request stay pending.
          remote.forEach(record => syncedVersions.set(record.id, record.version));
          syncedPreferencesVersion = remotePreferences?.version;
          emit({ records, preferences: preferences.values });
        });
      }
      failures = 0;
      retryAt = 0;
      emit({ lastSync: new Date().toISOString(), syncStatus: 'Synced' });
    } catch (error) {
      clearSyncTimer();
      if (error instanceof ApiError && error.status === 401) {
        sessionInvalid = true;
        emit({ syncStatus: 'Sign in again to sync' });
      } else {
        const limited = error instanceof ApiError && error.status === 429;
        const backoff = Math.min(300000, (limited ? 60000 : 5000) * 2 ** Math.min(failures++, 6));
        retryAt = Date.now() + Math.max(backoff, limited ? error.retryAfterMs ?? 0 : 0);
        emit({ syncStatus: limited ? 'Sync paused · changes saved on this device' : 'Offline · changes saved on this device' });
        scheduleSync();
      }
    } finally {
      emit({ syncing: false }); syncing = null;
      if (editRevision !== revision) scheduleSync();
    }
  })();
  return syncing;
}
export async function connect(email: string, password: string, register: boolean, includeLocal: boolean) {
  if (syncing) await syncing;
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
    clearSyncTimer();
    retryAt = 0;
    failures = 0;
    sessionInvalid = false;
    syncedAccountId = null;
    emit({ account: user, records, preferences: preferences.values, syncStatus: 'Waiting to sync', lastSync: null });
  });
  await sync();
}
export async function disconnect() {
  if (syncing) await syncing;
  await sync();
  const { disablePush } = await import('./notifications');
  await disablePush();
  await api('/auth/logout', {});
  await serial(async () => {
    const records = await readRecords(null);
    const preferences = await readPreferences(null);
    await setItem('account', 'null');
    savedPreferences = preferences;
    clearSyncTimer();
    retryAt = 0;
    failures = 0;
    sessionInvalid = false;
    syncedAccountId = null;
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
