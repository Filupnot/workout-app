# History metrics

All metrics use only **finished** workouts and **logged** sets. Suggested rows, drafts, and the workout in progress never count. Edited sets count with their corrected values, and removed sets do not count. Definitions live in `src/lib/domain/history.ts` and are tested in `tests/history.test.ts`.

| View | Definition |
| --- | --- |
| **Last time** | The most recent earlier finished workout with at least one logged set of that exercise. "N days ago" is the difference in calendar days between that workout's recorded local date and today, so a 23:30 session counts as that day even after changing time zones. The exact date is shown alongside. |
| **Consistency** | Finished workouts per calendar week (Monday start) for the last 8 weeks, plus the count in the last 30 days. |
| **Best weight at N reps** | For each workout, the heaviest logged set with exactly N reps. Sessions with no set at N reps are skipped. |
| **Volume per session** | Sum of weight × reps over all logged sets of that exercise and angle in the workout. |
| **Rowing pace** | Average time per 500 m = 500 × seconds ÷ meters. Pieces are grouped by distance rounded to the meter; different distances are never compared. |

**Units:** weights are stored as entered (lb or kg). Charts convert to your default unit (1 lb = 0.45359237 kg) only for comparison.

**Variants:** the same exercise at different angles is a separate series (for example "Incline bench press · 30°" and "· 45°"), so a change of setup is never read as a strength change. Renamed exercises keep one series under the newest name, and each past workout keeps the name it was logged with.

**Coverage:** History says how many finished workouts are on this device and since when. When older workouts have not been downloaded, it says trends are partial and offers **Load older workouts** (50 per page).

Worked example (tested): sessions of 100 lb × 8 and 110 lb × 8 at 30°, then 50 kg × 8 and 55 kg × 5 at 30°. In pounds, best at 8 reps is 110 lb, then 110.2 lb; volume is 1,680 lb, then 1,488.1 lb. An 80 lb × 8 set at 45° forms its own series.
