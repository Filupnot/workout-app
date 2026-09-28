# Spec Delta

## ADDED Requirements

### Requirement: Deleted workouts excluded from history
Deleted workouts and removed entries SHALL NOT appear in session lists, last-time context, workout frequency, strength trends, rowing trends, or history coverage counts.

#### Scenario: Last time after deletion
- **WHEN** the most recent session with an exercise is deleted
- **THEN** last time shows the next earlier session with that exercise, or the first-time state if none remains

#### Scenario: Metrics after deletion
- **WHEN** a mock workout is deleted
- **THEN** frequency, trend points, and the finished-workout count no longer include it
