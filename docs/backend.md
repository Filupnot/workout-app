# Backend setup, API, and operations

All values below are placeholders. Real account IDs, ARNs, domains, client IDs, and the owner subject live in AWS, GitHub repository settings, or your shell, never in Git.

| Placeholder | Meaning |
| --- | --- |
| `<region>` | AWS region, e.g. `us-west-2` |
| `<stack>` | App stack name, e.g. `workout` |
| `<prefix>` | Cognito hosted domain prefix (lowercase letters, digits, hyphens; cannot contain `aws` or `cognito`) |
| `<app-origin>` | `https://<subdomain>.<your-domain>` with no trailing slash |
| `<owner-parameter>` | SSM parameter name, e.g. `/workout/owner-subject` |

## 1. Google OAuth client

In Google Cloud Console → APIs & Services → Credentials, use a **Web application** OAuth client:

- Authorized JavaScript origin: `https://<prefix>.auth.<region>.amazoncognito.com`
- Authorized redirect URI: `https://<prefix>.auth.<region>.amazoncognito.com/oauth2/idpresponse`

Only the `openid` scope is requested; no email or profile data is read. Store the client secret in Secrets Manager yourself, so it never passes through chat, logs, or Git:

```sh
aws secretsmanager create-secret --region <region> --name <stack>/google-oauth \
  --secret-string "{\"clientSecret\":\"$(read -rs s; printf %s "$s")\"}"
```

## 2. Owner admission (fails closed)

Create the admission parameter **before** the first deploy with a value that can never match a subject:

```sh
aws ssm put-parameter --region <region> --name <owner-parameter> --type SecureString --value unset
```

The API compares each verified access token's `sub` with this value on every request (cached for 60 seconds). An empty, placeholder, or unreadable value denies every account: no workout data is reachable until you enroll yourself.

## 3. Deployment access (once)

`infra/deploy-access.yaml` creates the GitHub OIDC provider, a deploy role that only this repository's `backend` environment can assume, a CloudFormation execution role limited to `<stack>-*` resources, and a private artifact bucket.

```sh
aws cloudformation deploy --region <region> --stack-name <stack>-deploy-access \
  --template-file infra/deploy-access.yaml --capabilities CAPABILITY_IAM \
  --parameter-overrides GitHubRepository=<owner>/<repo> AppStackName=<stack> GoogleSecretArn=<secret-arn>
```

Then, in GitHub → Settings → Environments, create `backend` (optionally requiring your approval) and add:

- Secrets: `AWS_DEPLOY_ROLE_ARN`, `EXECUTION_ROLE_ARN`, `ARTIFACT_BUCKET` (stack outputs), `GOOGLE_SECRET_ARN`
- Variables: `AWS_REGION`, `STACK_NAME`, `APP_ORIGIN`, `GOOGLE_CLIENT_ID`, `OWNER_PARAMETER`, `AUTH_DOMAIN_PREFIX`

Run **Deploy backend** from the Actions tab. The same script works locally with those values exported: `./scripts/deploy-backend.sh`.

## 4. Frontend configuration

Copy the app stack outputs into repository **variables** (they are public identifiers, not secrets): `PUBLIC_API_URL` (ApiUrl), `PUBLIC_COGNITO_AUTHORITY` (Authority), `PUBLIC_COGNITO_CLIENT_ID` (ClientId), `PUBLIC_COGNITO_DOMAIN` (AuthDomain), and `APP_DOMAIN` (`<subdomain>.<your-domain>`). Leave `BASE_PATH` empty for a custom domain. **Publish site** runs on every push to `main`.

In Settings → Pages, set the custom domain and enforce HTTPS, and point a DNS `CNAME` record for the subdomain at `<owner>.github.io`.

## 5. Enroll the owner

1. Open the site and sign in with your Google account. The app shows "This account isn't on the list." This is expected.
2. Read your Cognito subject, without printing usernames or emails:

   ```sh
   aws cognito-idp list-users --region <region> --user-pool-id <pool-id> \
     --query 'Users[].{subject: Attributes[?Name==`sub`]|[0].Value, created: UserCreateDate}'
   ```

   With one user in the pool, that row is you. Otherwise pick the row created at your sign-in time.
3. `aws ssm put-parameter --region <region> --name <owner-parameter> --type SecureString --overwrite --value <subject>`
4. Within a minute, sign out of the app and sign in again.

To admit more people later, extend the check to a list. Records are already keyed by subject, so no data migration is needed.

## API contract (`/v1`)

Every request needs `Authorization: Bearer <Cognito access token>` with scope `workout/data`, issued to the configured app client. Browser requests must come from `<app-origin>`. Responses are JSON with `cache-control: no-store`.

| Method and path | Result |
| --- | --- |
| `GET /v1/profile` | `{ records: [{ key: "PROFILE", value, revision }] }` |
| `GET /v1/exercises?cursor=` | Library records, 50 per page, plus `cursor` when more exist |
| `GET /v1/workouts?cursor=` | Workout metadata, newest first, 50 per page |
| `GET /v1/workouts/<uuid>?cursor=` | That workout's metadata, entries, and sets; 404 if not yours or missing |
| `POST /v1/mutations` | Applies one mutation atomically and returns `{ revision }` |

A mutation is `{ id, aggregate, baseRevision, createdAt, changes: [{ key, value | null }] }` with 1–20 changes to one aggregate (`PROFILE`, `EXERCISE#<id>`, or `WORKOUT#<id>#META` with its entries and sets). Only sets can be deleted. Bodies are capped at 64 KB, and unknown fields, owner fields, and invalid values are rejected with 400.

| Status | Meaning |
| --- | --- |
| 400 / 413 / 415 | Invalid data, size, or content type |
| 401 | Missing, expired, forged, wrong-client, wrong-use, or wrong-scope token |
| 403 | Account not admitted, or a foreign origin |
| 404 | Unknown route or workout |
| 409 | `baseRevision` is stale because another device changed the record |
| 500 | Server problem; nothing was reported as saved |

Retrying a mutation with the same `id` returns the original result for 30 days (dedup markers expire by TTL). After that, the stale `baseRevision` still prevents a duplicate write.

Logs contain only request ID, route template, status, and duration. They never include tokens, subjects, IDs, or bodies. Log groups keep 14 days.

## Releases, rollback, and retention

- **Frontend:** every push to `main` publishes. To roll back, run **Publish site** with an older commit in `ref`. Drafts and queued changes live in IndexedDB and survive updates; the app offers the new version and never swaps it in mid-set.
- **Backend:** run **Deploy backend** with an older `ref`. The DynamoDB table and user pool have `DeletionPolicy: Retain`, and `UpdateReplacePolicy: Retain` on the table. A rollback or even a stack deletion leaves workout records in place.
- **Restore:** point-in-time recovery is enabled (35 days). Restore to a new table, verify it, then point the stack at it. Never delete the live table to fix a deploy.
- **Retention:** workout history has no expiry; only dedup markers expire, after 30 days.
- **Rotation:** Google secret: rotate it in Google, update the Secrets Manager value, and redeploy (CloudFormation re-resolves it). Admission: overwrite the SSM parameter; access follows within a minute. Revoke a device: sign out, or disable the Cognito user. Refresh tokens last 30 days and access tokens 15 minutes.
- **Isolation:** the stack creates only resources named for `<stack>`; it reads no other table, secret, or site.
