# Spec Delta

## ADDED Requirements

### Requirement: Removing mistaken entries and workouts
The app SHALL let the user remove any exercise entry, strength or rowing, together with its sets, from the workout in progress. It SHALL let the user delete a whole workout, in progress or finished. Every removal SHALL require explicit confirmation. Deleting the workout in progress SHALL end it and stop its rest timer. Library exercises remain archivable rather than deletable.

#### Scenario: Remove an exercise from today's workout
- **WHEN** the user confirms removal of an entry with three sets from the workout in progress
- **THEN** the entry and its three sets disappear, the remaining entries keep their order, and set counts exclude the removed sets

#### Scenario: Cancelled removal
- **WHEN** the user dismisses the confirmation
- **THEN** nothing is removed

#### Scenario: Discard the workout in progress
- **WHEN** the user confirms deletion of the workout in progress while rest is running
- **THEN** the workout, its entries, sets, and notes are removed, the timer stops, and Today shows no workout in progress

#### Scenario: Delete a past workout
- **WHEN** the user confirms deletion of a finished workout from History
- **THEN** it no longer appears in History or anywhere else in the app

#### Scenario: Library unaffected
- **WHEN** an entry for a library exercise is removed
- **THEN** the library exercise itself remains available
