import * as publicEnv from '$env/static/public';
import { dev } from '$app/environment';
import { base } from '$app/paths';

// Every value here is public and ships to the browser; none of them grants access.
const values = publicEnv as Record<string, string>;
export const apiUrl = values.PUBLIC_API_URL || '';
/** Device-only mode with synthetic data, for development and browser tests. Never enabled in deployments. */
export const localPreviewAllowed = dev || values.PUBLIC_LOCAL_PREVIEW === 'true';
export function authConfig() {
  const authority = values.PUBLIC_COGNITO_AUTHORITY || '';
  const clientId = values.PUBLIC_COGNITO_CLIENT_ID || '';
  const domain = values.PUBLIC_COGNITO_DOMAIN || '';
  if (!authority || !clientId || !domain || typeof location === 'undefined') return null;
  return { authority, clientId, domain, appUrl: `${location.origin}${base}/` };
}
