export class ApiError extends Error {
  constructor(message: string, public status: number, public retryAfterMs?: number) { super(message); }
}
export function retryAfterMs(value: string | null, now = Date.now()): number | undefined {
  if (value === null || !value.trim()) return undefined;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(delay) ? Math.max(0, delay) : undefined;
}
export const apiBase = process.env.EXPO_PUBLIC_API_URL || '/api';
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(apiBase + path, { method: body === undefined ? 'GET' : 'POST',
      credentials: 'include', headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(data.error || data.message || 'Request failed.', response.status, retryAfterMs(response.headers.get('Retry-After')));
    return data;
  } finally { clearTimeout(timeout); }
}
