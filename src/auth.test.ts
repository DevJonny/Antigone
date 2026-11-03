// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123');
const { authUrl, consumeRedirect, isValid, loadToken } = await import('./auth');

const returnFromGoogle = (fragment: string) => history.replaceState(null, '', `/Antigone/?x=1#${fragment}`);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  history.replaceState(null, '', '/Antigone/');
});

describe('authUrl', () => {
  it('asks Google for a calendar token sent back to the app root', () => {
    const url = new URL(authUrl('s1'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'client-123',
      redirect_uri: `${location.origin}${import.meta.env.BASE_URL}`,
      response_type: 'token',
      scope: 'https://www.googleapis.com/auth/calendar',
      state: 's1',
    });
  });
});

describe('consumeRedirect', () => {
  it('does nothing on a normal page load', () => {
    expect(consumeRedirect()).toEqual({});
  });

  it('saves the returned token and clears it from the URL', () => {
    sessionStorage.setItem('antigone.oauthState', 's1');
    returnFromGoogle('access_token=tok&expires_in=3600&state=s1');

    const { token } = consumeRedirect();

    expect(token?.accessToken).toBe('tok');
    expect(token!.expiresAt).toBeGreaterThan(Date.now() + 3500_000);
    expect(loadToken()).toEqual(token);
    expect(location.hash).toBe('');
    expect(location.search).toBe('?x=1');
  });

  it('rejects a token whose state does not match', () => {
    sessionStorage.setItem('antigone.oauthState', 's1');
    returnFromGoogle('access_token=tok&expires_in=3600&state=forged');

    expect(consumeRedirect().error).toMatch(/could not be verified/);
    expect(loadToken()).toBeNull();
  });

  it('rejects a token when no sign-in was started', () => {
    returnFromGoogle('access_token=tok&expires_in=3600&state=s1');
    expect(consumeRedirect().error).toMatch(/could not be verified/);
  });

  it('reports a refused consent', () => {
    sessionStorage.setItem('antigone.oauthState', 's1');
    returnFromGoogle('error=access_denied&state=s1');
    expect(consumeRedirect()).toEqual({ error: 'Google access was not granted.' });
  });
});

describe('tokens', () => {
  it('treats a token within a minute of expiry as expired', () => {
    expect(isValid({ accessToken: 't', expiresAt: Date.now() + 30_000 })).toBe(false);
    expect(isValid({ accessToken: 't', expiresAt: Date.now() + 120_000 })).toBe(true);
  });

  it('ignores a stored token that has expired', () => {
    localStorage.setItem('antigone.token', JSON.stringify({ accessToken: 't', expiresAt: Date.now() - 1 }));
    expect(loadToken()).toBeNull();
  });
});
