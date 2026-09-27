# Proposal

## Why

Logging a varied gym session should be as convenient as restarting a stopwatch. A mobile workout journal with immediate rest timing and reliable history will make consistent tracking practical without imposing a planned routine.

## What Changes

- Create an iPhone-first, installable web app with polished light/dark appearances, large touch targets, and a fixed, prominent rest timer.
- Start rest immediately after a set; select the exercise after the first set and enter actual weight and reps during rest. Default to three sets and 90 seconds, with editable values, overtime display, and optional foreground sound.
- Maintain a reusable push/pull/legs exercise library, session-specific details such as incline angle, notes, and ordered workout entries with historical snapshots.
- Record rowing duration, distance, and average 500 m split manually, plus stretch completion and session notes.
- Show past sessions, elapsed time since an exercise was performed, and exercise/rowing progress and workout consistency.
- Admit one configured Google account through Cognito; enforce user ownership throughout a dedicated Lambda/DynamoDB backend, ready for additional private accounts later.
- Save immediately on-device and synchronize safely when connected, with visible save status.
- Maintain the app in Git and publish to the owner's GitHub; deploy its static frontend through GitHub Pages on a configurable subdomain of the existing domain. Keep repository contents free of credentials, personal identifiers, and real workout data.

## Capabilities

### New Capabilities

- `workout-logging`: Flexible sessions, exercise library, individual sets, exercise details, rowing, stretching, and chronological order.
- `rest-timer`: Immediate persistent countdown, negative overtime, and optional foreground cue.
- `workout-history`: Historical detail, last-performed context, and comparable progress insights.
- `private-sync`: Google account admission, user-scoped storage, durable offline writes, and conflict handling.
- `mobile-delivery`: Accessible mobile presentation, Home Screen installation, secure GitHub publication, and isolated deployment.

### Modified Capabilities

None; this is a greenfield app with no existing capability specs.

## Impact

Adds a SvelteKit/TypeScript static frontend, local IndexedDB storage, Cognito Google federation, a Node.js Lambda API, a dedicated DynamoDB table, and reproducible AWS/deployment configuration. Reuses existing GitHub Pages and AWS patterns without modifying existing applications. Account allowlists, identity-provider credentials, deployment identifiers, and domain values remain external configuration.

## Non-goals

Friends' admission, shared workouts, social features, Concept2 photo parsing, Strava imports, native iOS distribution, and background/locked-phone rest notifications are deferred. No app implementation or infrastructure deployment occurs in this proposal workflow.
