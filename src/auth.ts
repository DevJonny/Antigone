const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCOPE = 'https://www.googleapis.com/auth/calendar';
const TOKEN_KEY = 'antigone.token';
const STATE_KEY = 'antigone.oauthState';
// Treat a token as expired a minute early so requests don't race its expiry.
const EXPIRY_MARGIN_MS = 60_000;

export const isConfigured = Boolean(CLIENT_ID);

export interface Token {
  accessToken: string;
  expiresAt: number;
}

export function isValid(token: Token | null): token is Token {
  return token !== null && token.expiresAt - EXPIRY_MARGIN_MS > Date.now();
}

function storage(kind: 'local' | 'session') {
  try {
    return kind === 'local' ? localStorage : sessionStorage;
  } catch {
    return null;
  }
}

export function loadToken(): Token | null {
  try {
    const token = JSON.parse(storage('local')?.getItem(TOKEN_KEY) ?? 'null') as Token | null;
    return isValid(token) ? token : null;
  } catch {
    return null;
  }
}

export function forgetToken() {
  try {
    storage('local')?.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable; the token only lived in memory.
  }
}

/** The app's own URL, which must be registered as a redirect URI on the OAuth client. */
const redirectUri = () => new URL(import.meta.env.BASE_URL, location.origin).href;

/**
 * Sends the page to Google's sign-in and back. A full-page redirect is used rather than
 * a popup because popups don't return reliably from iOS Home Screen apps.
 */
export function connect() {
  const state = crypto.randomUUID();
  storage('session')?.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: SCOPE,
    include_granted_scopes: 'true',
    state,
  });
  location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

/** Reads the token Google returns in the URL fragment after `connect`, then clears the fragment. */
export function consumeRedirect(): { token?: Token; error?: string } {
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.has('access_token') && !params.has('error')) return {};
  history.replaceState(null, '', location.pathname + location.search);

  const expected = storage('session')?.getItem(STATE_KEY);
  storage('session')?.removeItem(STATE_KEY);
  if (!expected || params.get('state') !== expected) return { error: 'Sign-in could not be verified. Please reconnect.' };
  if (params.has('error')) {
    return { error: params.get('error') === 'access_denied' ? 'Google access was not granted.' : `Sign-in failed: ${params.get('error')}` };
  }

  const token = {
    accessToken: params.get('access_token')!,
    expiresAt: Date.now() + Number(params.get('expires_in')) * 1000,
  };
  try {
    storage('local')?.setItem(TOKEN_KEY, JSON.stringify(token));
  } catch {
    // Storage unavailable; the token lives in memory for this page only.
  }
  return { token };
}
