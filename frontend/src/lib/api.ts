const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export function getToken() {
  return localStorage.getItem('lc_token');
}

export async function api(path: string, init?: RequestInit) {
  const token = getToken();
  const res = await fetch(API + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const message = typeof data === 'object' && data && 'error' in data ? (data as { error: string }).error : 'Something went wrong. Please try again.';
    throw new Error(message);
  }
  return data;
}
