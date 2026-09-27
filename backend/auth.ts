import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { ApiError } from './repository';
export function createAuthenticator(userPoolId: string, clientId: string, allowedSubject: () => Promise<string>, verifier = CognitoJwtVerifier.create({ userPoolId, tokenUse: 'access', clientId, scope: 'workout/data' })) {
  return async (token: string) => {
    let payload;
    try { payload = await verifier.verify(token); } catch { throw new ApiError(401, 'Sign in to continue.'); }
    const allowed = await allowedSubject();
    if (!allowed || payload.sub !== allowed) throw new ApiError(403, 'Account not admitted.');
    return payload.sub;
  };
}
