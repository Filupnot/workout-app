#!/usr/bin/env bash
# Builds and deploys the backend stack. All identifiers come from the environment, never from Git.
# Required: STACK_NAME ARTIFACT_BUCKET EXECUTION_ROLE_ARN APP_ORIGIN GOOGLE_CLIENT_ID GOOGLE_SECRET_ARN OWNER_PARAMETER AUTH_DOMAIN_PREFIX
set -euo pipefail
for name in STACK_NAME ARTIFACT_BUCKET EXECUTION_ROLE_ARN APP_ORIGIN GOOGLE_CLIENT_ID GOOGLE_SECRET_ARN OWNER_PARAMETER AUTH_DOMAIN_PREFIX; do
  if [ -z "${!name:-}" ]; then echo "Missing $name" >&2; exit 1; fi
done
npm run test:bundle
out="$(mktemp -d)"
aws cloudformation package --template-file infra/template.yaml --s3-bucket "$ARTIFACT_BUCKET" \
  --s3-prefix "$STACK_NAME" --output-template-file "$out/packaged.yaml" > /dev/null
aws cloudformation deploy --stack-name "$STACK_NAME" --template-file "$out/packaged.yaml" \
  --role-arn "$EXECUTION_ROLE_ARN" --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --no-fail-on-empty-changeset \
  --parameter-overrides "AppOrigin=$APP_ORIGIN" "GoogleClientId=$GOOGLE_CLIENT_ID" "GoogleSecretArn=$GOOGLE_SECRET_ARN" \
    "OwnerParameter=$OWNER_PARAMETER" "AuthDomainPrefix=$AUTH_DOMAIN_PREFIX" > /dev/null
echo "Deployed $STACK_NAME."
