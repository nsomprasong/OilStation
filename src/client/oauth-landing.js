/**
 * A Google/Facebook OAuth redirect lands on /auth/callback in the same browser.
 * Supabase first exchanges the PKCE code and persists the session. Then serve
 * the authenticated workspace from the canonical root via a fresh document
 * navigation. Chrome/Android Custom Tabs can carry the provider's desktop
 * viewport mode into the callback page until a full navigation/reload.
 *
 * The redirect runs ONLY on the callback after a persisted authenticated session
 * is available; '/' never redirects, so it cannot loop.
 */
export function canonicalLandingAfterOAuth(pathname,session){
 return pathname==='/auth/callback'&&typeof session?.access_token==='string'&&
   session.access_token.length>0?'/':null;
}
