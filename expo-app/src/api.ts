export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export const apiBase = process.env.EXPO_PUBLIC_API_URL || '/api';
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(apiBase + path, { method: body === undefined ? 'GET' : 'POST',
      credentials: 'include', headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(data.error || data.message || 'Request failed.', response.status);
    return data;
  } finally { clearTimeout(timeout); }
}
