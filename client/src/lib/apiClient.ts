export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

// In a packaged Android build the API must be reachable over HTTPS; a clear-text
// URL in a release build would leak the session. Debug/local (10.0.2.2) is fine.
if (
  import.meta.env.MODE === 'capacitor' &&
  BASE_URL !== '' &&
  !BASE_URL.startsWith('https://')
) {
  console.warn(
    '[Smart Finance] VITE_API_URL is not HTTPS. Release builds MUST use an HTTPS backend.',
  );
}

interface ErrorPayload {
  success: boolean;
  error?: { code?: string; message?: string; details?: Array<{ path?: string; message?: string }> };
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

let cachedCsrfToken: string | null = null;

/** Mints (once) the double-submit CSRF pair: readable cookie + header token. */
async function ensureCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;
  const res = await fetch(`${BASE_URL}/api/v1/auth/csrf`, { credentials: 'include' });
  if (!res.ok) {
    throw new ApiError('Could not start a secure session. Reload the page.', 'CSRF_MISSING', res.status);
  }
  const payload = (await res.json()) as { data: { csrfToken: string } };
  cachedCsrfToken = payload.data.csrfToken;
  return cachedCsrfToken;
}

function clearCsrfCache(): void {
  cachedCsrfToken = null;
}

/** One silent renewal attempt per session: the refresh cookie rotates on success. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const csrf = await ensureCsrfToken();
        const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-CSRF-Token': csrf },
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export async function api<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};

  if (method !== 'GET') {
    headers['X-CSRF-Token'] = await ensureCsrfToken();
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  // Access tokens are short-lived: one silent renewal, then the request again.
  // Session restoration (/auth/me) must renew too, or a 15-minute access token
  // would log the user out on every page reload past expiry. The refresh call
  // itself never retries, and wrong-password logins (INVALID_CREDENTIALS) are
  // surfaced as-is instead of triggering a pointless renewal.
  let renewalWorthy = false;
  if (res.status === 401 && !retried) {
    const probe = (await res.clone().json().catch(() => null)) as ErrorPayload | null;
    renewalWorthy =
      path !== '/api/v1/auth/refresh' &&
      (!path.startsWith('/api/v1/auth/') || path === '/api/v1/auth/me') &&
      (!probe?.error || probe.error.code === 'UNAUTHENTICATED');
  }

  if (renewalWorthy) {
    const renewed = await refreshSession();
    if (renewed) {
      return api<T>(path, options, true);
    }
  }

  if (res.status === 401 && path.startsWith('/api/v1/auth/')) {
    clearCsrfCache();
  }

  const payload = (await res.json().catch(() => null)) as (T & { success?: boolean }) | ErrorPayload | null;

  if (!res.ok || payload === null || payload.success !== true) {
    const error = (payload as ErrorPayload | null)?.error;
    const fieldErrors: Record<string, string> = {};
    for (const detail of error?.details ?? []) {
      if (detail.path && detail.message && !(detail.path in fieldErrors)) {
        fieldErrors[detail.path] = detail.message;
      }
    }
    throw new ApiError(
      error?.message ?? 'Something went wrong. Please try again.',
      error?.code ?? 'REQUEST_FAILED',
      res.status,
      fieldErrors,
    );
  }

  return payload as T;
}
