import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';

export type AuthConfig = { authority: string; clientId: string; appUrl: string; domain: string };
type Manager = Pick<UserManager, 'signinRedirect' | 'signinRedirectCallback' | 'getUser' | 'signinSilent' | 'revokeTokens' | 'removeUser' | 'clearStaleState'>;
export type Browser = { replaceUrl(url: string): void; assign(url: string): void; storage: Storage };
export class SignInRequired extends Error { constructor() { super('Sign in to sync.'); } }
export const ADMITTED_KEY = 'workout-admitted';

export function createManager(config: AuthConfig, storage: Storage) {
  // Authorization code flow with PKCE (the oidc-client-ts default); no client secret exists in the browser.
  return new UserManager({ authority: config.authority, client_id: config.clientId,
    redirect_uri: `${config.appUrl}auth/callback/`, post_logout_redirect_uri: config.appUrl,
    response_type: 'code', scope: 'openid workout/data', loadUserInfo: false,
    // Cognito renews with refresh tokens; it does not support iframe silent sign-in.
    automaticSilentRenew: false,
    userStore: new WebStorageStateStore({ store: storage }), stateStore: new WebStorageStateStore({ store: storage }),
    extraQueryParams: { identity_provider: 'Google' }
  });
}

export function createSession(config: AuthConfig, browser: Browser = {
  replaceUrl: url => history.replaceState(null, '', url), assign: url => location.assign(url), storage: localStorage
}, manager: Manager = createManager(config, browser.storage)) {
  const callbackPath = `${new URL(config.appUrl).pathname}auth/callback/`;
  let refreshing: Promise<User | null> | undefined;
  return {
    signIn: () => manager.signinRedirect(),
    async callback() {
      try { return await manager.signinRedirectCallback(); }
      catch (error) {
        // An abandoned, replayed, or denied redirect leaves stale PKCE state behind.
        await manager.clearStaleState().catch(() => {});
        throw error;
      } finally { browser.replaceUrl(callbackPath); }
    },
    async current(): Promise<User | null> { return manager.getUser(); },
    async token() {
      let user = await manager.getUser();
      if (user?.expired) {
        if (!user.refresh_token) throw new SignInRequired();
        refreshing ??= manager.signinSilent().finally(() => { refreshing = undefined; });
        try { user = await refreshing; } catch { throw new SignInRequired(); }
      }
      if (!user?.access_token) throw new SignInRequired();
      return user.access_token;
    },
    async signOut() {
      // Revocation is best effort; local session material is always removed.
      try { await manager.revokeTokens(['refresh_token']); } catch { /* offline or already revoked */ }
      await manager.removeUser();
      browser.storage.removeItem(ADMITTED_KEY);
      const url = new URL('/logout', config.domain);
      url.searchParams.set('client_id', config.clientId);
      url.searchParams.set('logout_uri', config.appUrl);
      browser.assign(url.toString());
    }
  };
}
export type Session = ReturnType<typeof createSession>;
