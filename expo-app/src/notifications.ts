export function pushSupport(): string { return 'Push reminders are available in the installed web app. Native notifications are not available yet.'; }
export async function pushStatus(): Promise<boolean> { return false; }
export async function preparePush(): Promise<void> {}
export async function enablePush(): Promise<void> { throw new Error(pushSupport()); }
export async function disablePush(): Promise<void> {}
