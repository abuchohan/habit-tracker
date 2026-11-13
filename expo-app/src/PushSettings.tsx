import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useStore } from './store';
import { Button, Label, useTheme } from './ui';
import { disablePush, enablePush, preparePush, pushStatus, pushSupport } from './notifications';

export function PushSettings() {
  const { account } = useStore(), t = useTheme();
  const [enabled, setEnabled] = useState(false), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const support = pushSupport();
  useEffect(() => {
    let active = true;
    if (account && !support) Promise.all([preparePush(), pushStatus()]).then(([, value]) => { if (active) { setEnabled(value); setReady(true); } }).catch(() => { if (active) setError('Could not check push settings. Check your connection and reopen this screen.'); });
    return () => { active = false; };
  }, [account, support]);
  async function change() {
    setBusy(true); setError('');
    try { if (enabled) await disablePush(); else await enablePush(); setEnabled(!enabled); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not change notifications.'); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 8 }}>
    <Label muted>{support || (account ? 'Enable push on each device where you want reminders. Choose times and days in Edit habit.' : 'Connect a sync account to receive push reminders while the app is closed.')}</Label>
    {account && !support && <Button disabled={busy || !ready} onPress={change}>{busy ? 'Updating notifications…' : enabled ? 'Turn off push on this device' : 'Enable push on this device'}</Button>}
    {enabled && <Label muted>Push is enabled on this device.</Label>}
    {!!error && <Label accessibilityRole="alert" style={{ color: t.danger }}>{error}</Label>}
  </View>;
}
