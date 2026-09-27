# Spec Delta

## Purpose

Deliver a polished, installable iPhone web experience through reproducible hosting without exposing private configuration or data.

## ADDED Requirements

### Requirement: Mobile appearance and accessibility
The app SHALL support iPhone browser and Home Screen use, light/dark/system appearance, readable contrast, labeled controls, safe-area layout, and touch targets at least 44 CSS pixels.

#### Scenario: Dark appearance
- **WHEN** the user selects dark mode and reopens the app
- **THEN** the selected appearance is retained

#### Scenario: Narrow viewport
- **WHEN** the app runs at a 375 CSS-pixel viewport with a numeric keyboard
- **THEN** core logging controls and the timer remain usable without horizontal scrolling

### Requirement: Installable offline shell
After an initial online load, the app SHALL support Home Screen installation and reopening its cached shell offline, without treating installation or notification permission as prerequisites for logging.

#### Scenario: Offline reopen
- **WHEN** a previously loaded signed-in user launches the Home Screen app offline
- **THEN** cached views and local workout logging work

#### Scenario: Browser use
- **WHEN** a user opens the app in Safari without installing
- **THEN** core logging remains available

### Requirement: Safe GitHub publication
The app SHALL be maintained in a dedicated Git repository published to the owner's GitHub, private by default. Tracked content and outgoing history SHALL exclude secrets, personal account identifiers, real workout data, and local state; examples and tests SHALL use synthetic data.

#### Scenario: Prepublication scan
- **WHEN** a staged file or outgoing commit contains a credential or personal fixture
- **THEN** publication is blocked until the material is removed from outgoing content and history

#### Scenario: Repository visibility
- **WHEN** private hosting eligibility is unavailable
- **THEN** no automatic change to public repository visibility occurs

### Requirement: Isolated secure deployment
The deployed app SHALL use HTTPS, a configurable subdomain, dedicated backend resources, authenticated data access, and externally supplied configuration. Deployment SHALL preserve existing apps and allow rollback without deleting workout data.

#### Scenario: Deployment
- **WHEN** the new frontend and backend are released
- **THEN** existing websites and their data remain unaffected

#### Scenario: Rollback
- **WHEN** a release is reverted
- **THEN** stored workout records remain intact

#### Scenario: Runtime configuration
- **WHEN** the frontend is built for deployment
- **THEN** only necessary public identifiers are included; private secrets and the owner allowlist remain server-side
