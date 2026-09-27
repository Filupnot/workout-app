# Workout

An iPhone-first workout journal for strength, rowing, and recovery. Implementation is in progress; the current screen is a static foundation, not a functioning tracker. The approved plan lives in `openspec/changes/build-workout-tracker/`.

## Local development

Use Node.js 22.12 or newer within the Node 22 release line and npm 10.

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

No credentials are required to run the current scaffold. Do not enter real workout data into development fixtures.

```sh
npm test
npm run check
npm run build
npm run preview -- --host 127.0.0.1
```

Static output is written to `build/`. Routes use trailing slashes for static hosting. Set `BASE_PATH` for a repository URL; leave it empty for a custom domain. Deployment is not enabled yet.

## Configuration and privacy

`.env.example` documents public browser identifiers. Copy it to an ignored local environment file only when configuration is available. Any `PUBLIC_` value is visible to visitors and must never be a secret. Owner admission and Google secrets belong in restricted server configuration, never in the frontend or Git.

Only synthetic data belongs in fixtures. Keep personal profiles, workout records, authentication tokens, deployment output, and local agent/editor state out of the repository. Configure a GitHub noreply Git identity locally. Review staged content and run:

```sh
git diff --cached
npm run privacy:check
```

The privacy checker examines staged blobs and reachable Git history, reporting paths and categories without printing detected values. It catches common credential formats, personal emails, local paths, and forbidden files. It is a guardrail, not proof that arbitrary text is free of personal information; manually review every publication. CI runs the same checks with full history.

The repository defaults to private. GitHub Pages eligibility must be checked before enabling deployment; repository visibility must never be changed automatically to work around an account limitation.
