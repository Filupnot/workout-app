# Spec Delta

## Purpose

Provide an immediately accessible rest countdown independent of workout data entry, including clear overtime feedback.

## ADDED Requirements

### Requirement: Immediate independent timing
The app SHALL start a default 90-second rest on explicit tap before exercise selection or data entry and SHALL keep logging actions independent of timing.

#### Scenario: First set
- **WHEN** a user taps Start rest before choosing an exercise
- **THEN** the countdown begins immediately while exercise selection remains available

#### Scenario: Save during rest
- **WHEN** a user saves a set 20 seconds into rest
- **THEN** the timer continues with approximately 70 seconds remaining

### Requirement: Persistent visible overtime
The app SHALL keep the timer visible outside scrolling content, including while entering numbers, and calculate remaining time from a persisted deadline across navigation and reload. It SHALL show negative time after zero.

#### Scenario: Scroll and keyboard
- **WHEN** a user scrolls a long workout with the numeric keyboard open
- **THEN** the timer remains visible

#### Scenario: Return late
- **WHEN** the user returns 25 seconds after the deadline
- **THEN** the display shows approximately -0:25 instead of restarting or stopping at zero

### Requirement: Timer controls
The app SHALL support restart, skip, and rest-duration adjustment, and SHALL stop the active timer when the workout ends.

#### Scenario: Restart
- **WHEN** a user restarts during overtime
- **THEN** one new countdown replaces the previous timer

#### Scenario: End workout
- **WHEN** a user finishes the session with rest active
- **THEN** the timer stops and cannot play a later cue

### Requirement: Optional foreground cue only
The app SHALL offer a disabled-by-default soft cue that sounds at most once at expiry while foregrounded. It SHALL NOT request notifications or play catch-up or repeated overtime cues in this release.

#### Scenario: Enabled foreground sound
- **WHEN** an enabled timer expires while the app is visible
- **THEN** one soft cue plays without a notification banner

#### Scenario: Hidden expiry
- **WHEN** the timer expires while the phone is locked and the user later returns
- **THEN** overtime is displayed without a delayed cue

#### Scenario: Silent preference
- **WHEN** the sound preference is disabled
- **THEN** expiry changes the display without sound
