import { createAuthClient } from '@neondatabase/neon-js/auth';

type AuthResponse = Record<string, any>;
type MaybeString = string | null;

export type AuthIdentity = {
  externalAuthId: string;
  email: MaybeString;
};

const neonAuthUrl =
  (import.meta.env.VITE_NEON_AUTH_URL as string | undefined) ||
  (import.meta.env.VITE_NEON_AUTH_BASE_URL as string | undefined);
const authBypass = String(import.meta.env.VITE_BYPASS_AUTH ?? 'false').toLowerCase() === 'true';
const authCallbackOverride =
  (import.meta.env.VITE_NEON_AUTH_CALLBACK_URL as string | undefined) ||
  (import.meta.env.VITE_APP_URL as string | undefined);

let authClient: ReturnType<typeof createAuthClient> | null = null;

function getAuthClient(): ReturnType<typeof createAuthClient> {
  if (!neonAuthUrl) {
    throw new Error('VITE_NEON_AUTH_URL is not set.');
  }
  if (!authClient) {
    authClient = createAuthClient(neonAuthUrl.replace(/\/$/, ''));
  }
  return authClient;
}

function unwrapAuthResult<T extends AuthResponse>(result: T, fallback: string): T {
  const code = result?.error?.code || result?.code;
  const message = result?.error?.message || result?.error || result?.message;
  if (String(code || '').toUpperCase() === 'INVALID_CALLBACKURL') {
    throw new Error(
      'Neon Auth rejected the callback URL (403 INVALID_CALLBACKURL). Add your exact app URL to Neon allowed callbacks and set VITE_NEON_AUTH_CALLBACK_URL.'
    );
  }
  if (typeof message === 'string' && message.trim()) {
    throw new Error(message);
  }
  if (result?.error && typeof result.error === 'object' && typeof result.error.message === 'string') {
    throw new Error(result.error.message);
  }
  if (result == null) {
    throw new Error(fallback);
  }
  return result;
}

function resolveCallbackUrl(): string {
  const raw = typeof authCallbackOverride === 'string' ? authCallbackOverride.trim() : '';
  if (!raw) {
    return window.location.origin;
  }

  try {
    if (/^https?:\/\//i.test(raw)) {
      return new URL(raw).toString();
    }
    return new URL(raw, window.location.origin).toString();
  } catch {
    return window.location.origin;
  }
}

function unwrapPayload(result: AuthResponse | null): AuthResponse | null {
  if (!result || typeof result !== 'object') return null;
  if (result.data && typeof result.data === 'object') {
    return result.data as AuthResponse;
  }
  return result;
}

function asNonEmptyString(value: unknown): MaybeString {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function readSessionAndUser(payload: AuthResponse | null): { session: AuthResponse | null; user: AuthResponse | null } {
  if (!payload) return { session: null, user: null };
  const session = (payload.session && typeof payload.session === 'object') ? payload.session : null;
  const userFromSession = session?.user && typeof session.user === 'object' ? session.user : null;
  const user = userFromSession || ((payload.user && typeof payload.user === 'object') ? payload.user : null);
  return { session, user };
}

function extractIdentity(payload: AuthResponse | null): AuthIdentity | null {
  const { session, user } = readSessionAndUser(payload);
  const externalAuthId =
    asNonEmptyString(user?.id) ||
    asNonEmptyString(session?.user_id) ||
    asNonEmptyString(user?.sub) ||
    asNonEmptyString(payload?.sub) ||
    asNonEmptyString(user?.email);

  if (!externalAuthId) return null;
  return {
    externalAuthId,
    email: asNonEmptyString(user?.email) || asNonEmptyString(payload?.email),
  };
}

function getBypassIdentity(): AuthIdentity {
  const key = 'rcic-external-auth-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `dev-${Date.now()}`;
    localStorage.setItem(key, id);
  }
  return { externalAuthId: id, email: null };
}

export async function getNeonSession(): Promise<AuthResponse | null> {
  if (!neonAuthUrl) return null;
  try {
    const session = await getAuthClient().getSession();
    return unwrapPayload((session as AuthResponse) || null);
  } catch {
    return null;
  }
}

export async function getAuthIdentity(): Promise<AuthIdentity | null> {
  if (authBypass) {
    return getBypassIdentity();
  }
  const session = await getNeonSession();
  return extractIdentity(session);
}

export function isAuthBypassEnabled(): boolean {
  return authBypass;
}

export async function neonSignInWithEmail(email: string, password: string): Promise<AuthResponse> {
  const result = await getAuthClient().signIn.email({ email, password });
  return unwrapAuthResult((result as AuthResponse) || {}, 'Email sign-in failed.');
}

export async function neonSignUpWithEmail(name: string, email: string, password: string): Promise<AuthResponse> {
  const result = await getAuthClient().signUp.email({ name, email, password });
  return unwrapAuthResult((result as AuthResponse) || {}, 'Email sign-up failed.');
}

export async function neonStartSocialSignIn(provider: 'google' | 'microsoft'): Promise<void> {
  try {
    const result = await getAuthClient().signIn.social({
      provider,
      callbackURL: resolveCallbackUrl(),
    });

    const payload = unwrapAuthResult((result as AuthResponse) || {}, 'Social sign-in failed.');
    const redirect = payload?.data?.url || payload?.url || payload?.redirectTo || payload?.redirect;
    if (typeof redirect === 'string' && redirect) {
      window.location.assign(redirect);
    }
  } catch (error: any) {
    const msg = String(error?.message || '');
    if (msg.includes('INVALID_CALLBACKURL') || msg.includes('callback URL') || msg.includes('HTTP 403')) {
      throw new Error(
        'Social login callback is not allowed. Add your exact app URL to Neon Auth callback/origin allow-lists and set VITE_NEON_AUTH_CALLBACK_URL to that same URL.'
      );
    }
    throw error;
  }
}

export async function neonSignOut(): Promise<void> {
  const result = await getAuthClient().signOut();
  unwrapAuthResult((result as AuthResponse) || { ok: true }, 'Sign-out failed.');
}
