import React, { useState } from 'react';
import { Button, Check, Choices, Input, Label, Sheet } from './ui';
import { connect, disconnect, sync, useStore } from './store';
import { api } from './api';
import { clearResetToken } from './platform';
export function Account({ onClose, token }: { onClose: () => void; token?: string | null }) {
  const store = useStore(), [mode, setMode] = useState(token ? 'reset' : 'login'), [email, setEmail] = useState(store.account?.email ?? ''), [password, setPassword] = useState('');
  const [includeLocal, setIncludeLocal] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  async function run(fn: () => Promise<void>) { setBusy(true); setError(''); setMessage(''); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to connect.'); } finally { setBusy(false); } }
  return <Sheet title={token ? 'Reset password' : 'Account & sync'} onClose={onClose}>
    {store.account && !token ? <>
      <Label>{store.account.email}</Label><Label muted>{store.syncStatus}</Label>{store.lastSync && <Label muted>Last synced: {new Date(store.lastSync).toLocaleString()}</Label>}
      <Label muted>Your account’s habits remain available offline on this device. Signing out returns to your separate local habits.</Label>
      <Button primary disabled={busy || store.syncing} onPress={() => run(sync)}>Sync now</Button>
      <Button disabled={busy} onPress={() => run(async () => { await disconnect(); onClose(); })}>Sign out</Button>
      {store.syncStatus.includes('Sign in') && <><Input label="Password" secureTextEntry value={password} onChangeText={setPassword} autoComplete="current-password" /><Button primary disabled={busy} onPress={() => run(async () => { await connect(email, password, false, false); onClose(); })}>Sign in again</Button></>}
    </> : <>
      {!token && <Label muted>An account is optional. Connect one to sync your habits across your devices. Without one, everything stays in this browser.</Label>}
      {!token && <Choices value={mode} options={[["login", 'Sign in'], ['register', 'Create account'], ['forgot', 'Forgot password']]} onChange={v => { setMode(v); setError(''); setMessage(''); }} />}
      {!token && <Input label="Email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} />}
      {mode !== 'forgot' && <Input label={token ? 'New password' : 'Password'} secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChangeText={setPassword} />}
      {!token && ['login', 'register'].includes(mode) && !store.account && store.records.some(r => r.kind === 'habit' && !r.deleted) &&
        <Check label="Include my local habits in this account" detail="A copy will be uploaded and merged with this account’s habits. Your local copy is kept separately." value={includeLocal} onChange={setIncludeLocal} />}
      <Button primary disabled={busy} onPress={() => run(async () => {
        if (token) { await api(`/auth/reset-password/${token}`, { password }); clearResetToken(); setMessage('Password changed. Close this dialog and sign in.'); }
        else if (mode === 'forgot') { const result = await api<{ message: string }>('/auth/reset-password', { email }); setMessage(result.message); }
        else { await connect(email, password, mode === 'register', includeLocal); onClose(); }
      })}>{busy ? 'Please wait…' : token ? 'Change password' : mode === 'forgot' ? 'Send reset email' : mode === 'register' ? 'Create account & connect' : 'Connect account'}</Button>
    </>}
    {!!error && <Label style={{ color: '#d32f2f' }}>{error}</Label>}{!!message && <Label>{message}</Label>}
  </Sheet>;
}
