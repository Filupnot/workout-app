# Spec Delta

## Purpose

Make past workouts and comparable performance trends understandable without losing original session details.

## ADDED Requirements

### Requirement: Historical detail and recency
The app SHALL show completed sessions with original entry/set order, weights, reps, units, exercise details, rowing results, stretch status, and notes. Last time SHALL identify the latest earlier performed session with elapsed calendar days and an available exact date.

#### Scenario: Last performed
- **WHEN** an exercise was last performed nine local calendar days ago with varied sets
- **THEN** the app shows 9 days ago and the actual previous sets and details

#### Scenario: No history
- **WHEN** an exercise has no earlier completed sets
- **THEN** the app shows a clear first-time state without fabricated defaults presented as history

### Requirement: Comparable insights
The app SHALL show completed workout frequency, per-exercise weight/rep and volume trends, and rowing pace for matching distances. It SHALL distinguish exercise-angle variants, normalize units for comparisons, exclude unconfirmed sets, and identify partial history coverage.

#### Scenario: Angle comparison
- **WHEN** history contains different incline angles
- **THEN** performance views separate those variants

#### Scenario: Incomplete sets
- **WHEN** a session contains two confirmed sets and one suggested row
- **THEN** only the two confirmed sets contribute to metrics

#### Scenario: Rowing cohorts
- **WHEN** rows have different distances
- **THEN** pace comparisons group matching distances

#### Scenario: Paginated history
- **WHEN** older history has not loaded
- **THEN** the displayed coverage is explicit and older sessions can be loaded
