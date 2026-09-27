# Spec Delta

## Purpose

Capture varied gym sessions with minimal after-set input while preserving their actual order and details.

## ADDED Requirements

### Requirement: Flexible sessions
The app SHALL allow an empty session to receive strength and rowing entries in performed order, a stretch-completed flag, and session notes; it SHALL preserve drafts and allow resuming and finishing a session.

#### Scenario: Mixed workout
- **WHEN** a user logs weights, rowing, and stretching then finishes
- **THEN** the session retains all entries in their recorded order and the stretch flag and notes

#### Scenario: Resume draft
- **WHEN** the app reloads during an unfinished session
- **THEN** the session and unsaved entry draft are restored

### Requirement: Reusable exercise library
The app SHALL provide editable saved exercises categorized as push, pull, or legs, prioritize recently used choices, and retain historical data when definitions are renamed or archived.

#### Scenario: Select exercise
- **WHEN** a user chooses a saved exercise
- **THEN** its name, category, and remembered details populate the entry without retyping

#### Scenario: Historical snapshot
- **WHEN** an exercise is renamed or its default angle changes
- **THEN** existing workout entries retain their original name and angle

### Requirement: After-set logging
The app SHALL allow exercise selection after the first set during rest, suggest three sets, and record actual weight, unit, and positive integer reps separately for each confirmed set. Suggestions SHALL NOT count as completed sets.

#### Scenario: Varying sets
- **WHEN** three confirmed sets have different weights and reps
- **THEN** all three retain their individual values and order

#### Scenario: Prefill
- **WHEN** a user opens the next set
- **THEN** previous actual values are suggested and remain editable

#### Scenario: Correction
- **WHEN** a user edits or removes a mistaken set or adds a fourth set
- **THEN** the workout and derived history reflect only the resulting confirmed sets

#### Scenario: Invalid set
- **WHEN** a user enters negative weight or nonpositive or fractional reps
- **THEN** the app explains the error and does not confirm the set

### Requirement: Exercise nuances
The app SHALL store optional angle and plain-text notes with each exercise entry and allow repeated entries for the same exercise with different details.

#### Scenario: Angle variants
- **WHEN** a user performs incline bench at two angles
- **THEN** separate ordered entries preserve each angle and its sets

#### Scenario: Feeling note
- **WHEN** a user records how an exercise felt
- **THEN** the note is visible in that session without becoming a required input

### Requirement: Manual rowing
The app SHALL accept any two positive values among duration, distance, and average time per 500 meters and derive the third; inconsistent triples SHALL require correction within documented display-rounding tolerance.

#### Scenario: Derived split
- **WHEN** a user enters 2000 meters and 480 seconds
- **THEN** the app displays 2:00 per 500 meters

#### Scenario: Derived distance
- **WHEN** a user enters 600 seconds and a 2:00 split
- **THEN** the app derives 2500 meters

#### Scenario: Inconsistent results
- **WHEN** entered duration, distance, and split disagree beyond rounding tolerance
- **THEN** the app requests correction rather than silently changing submitted values
