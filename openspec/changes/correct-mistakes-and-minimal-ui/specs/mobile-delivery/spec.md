# Spec Delta

## ADDED Requirements

### Requirement: Minimal copy with on-demand help
Screens SHALL limit visible text to short page titles, control labels, values, status, errors, empty-state prompts, and brief instructions needed to operate a control. Taglines, decorative eyebrows, and explanatory captions SHALL NOT appear in views. A single labeled info control SHALL open help covering logging, rest timer and sound limits, sync states, and history metric definitions. Every control SHALL keep an accessible label.

#### Scenario: Logging screen
- **WHEN** a workout is in progress
- **THEN** the screen shows the timer, exercise, set rows, entry controls, and actions without explanatory sentences

#### Scenario: On-demand help
- **WHEN** the user opens the info control
- **THEN** help explains foreground-only sound, sync status meanings, and metric definitions, and closes without affecting the workout or timer

#### Scenario: Instructions retained
- **WHEN** the user opens rowing entry
- **THEN** a brief instruction states that any two values calculate the third
