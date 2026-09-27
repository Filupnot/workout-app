# Workout

An iPhone-first workout journal for strength, rowing, and recovery: tap once when a set ends to start rest, log the details while you recover, and see what you did last time. Data is saved on the device first and synced to a private backend. The plan lives in `openspec/changes/build-workout-tracker/`.

- [Logging and the rest timer](docs/using.md)
- [Saving and sync states](docs/sync.md)
- [History metrics](docs/metrics.md)
- [Backend setup, API, and operations](docs/backend.md)
- [Data model and local storage](docs/data.md)

## Local development

Use Node.js 22.12 or newer within the Node 22 release line and npm 10.

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

No credentials are needed locally: the dev server offers **Open local preview**, a device-only mode that never syncs. Don't put real workout data in fixtures.

```sh
npm test          # unit and API tests
npm run test:e2e  # iPhone-sized WebKit and Chromium browser tests
npm run check
npm run build
npm run preview -- --host 127.0.0.1
```

Static output is written to `build/`. Routes use trailing slashes for static hosting. Set `BASE_PATH` for a repository URL, and leave it empty for a custom domain. Deployment runs through GitHub Actions; see [docs/backend.md](docs/backend.md).

## Configuration and privacy

`.env.example` documents public browser identifiers. Copy it to an ignored local environment file only when configuration is available. Any `PUBLIC_` value is visible to visitors and must never be a secret. Owner admission and Google secrets belong in restricted server configuration, never in the frontend or Git.

Only synthetic data belongs in fixtures. Keep personal profiles, workout records, authentication tokens, deployment output, and local agent/editor state out of the repository. Configure a GitHub noreply Git identity locally. Review staged content and run:

```sh
git diff --cached
npm run privacy:check
```

The privacy checker examines staged blobs and reachable Git history, reporting paths and categories without printing detected values. It catches common credential formats, personal emails, local paths, and forbidden files. It is a guardrail, not proof that arbitrary text is free of personal information; manually review every publication. CI runs the same checks with full history.

The owner explicitly selected public source and GitHub Pages. Workout records, credentials, and account admission remain private and outside Git.
