import { entries, sets, workouts } from '$lib/domain/history';
import { formatTime } from '$lib/domain/rowing';
import type { WorkoutRecord } from '$lib/domain/model';

/** Plain-language lines describing one aggregate, for comparing two versions side by side. */
export function describe(records: WorkoutRecord[]): string[] {
  const lines: string[] = [];
  for (const r of records) {
    if (r.kind === 'profile') lines.push(`Units: ${r.unit}`, `Theme: ${r.theme}`, `Rest: ${r.restSeconds} s`, `Sound: ${r.sound ? 'on' : 'off'}`);
    if (r.kind === 'exercise') lines.push(`${r.name} (${r.category})${r.details.angle !== undefined ? ` at ${r.details.angle}°` : ''}${r.archived ? ', archived' : ''}`);
  }
  for (const w of workouts(records)) {
    lines.push(`${w.localDate}, ${w.status === 'finished' ? 'finished' : 'in progress'}${w.stretched ? ', stretched' : ''}`);
    for (const e of entries(records, w.id)) {
      if (e.kind === 'rowing') lines.push(`Rowing: ${Math.round(e.meters)} m in ${formatTime(e.seconds)}`);
      else {
        const done = sets(records, e.id).map(s => `${s.weight} ${s.unit} × ${s.reps}`);
        lines.push(`${e.exerciseName}${e.details.angle !== undefined ? ` ${e.details.angle}°` : ''}: ${done.length ? done.join(', ') : 'no sets'}`);
      }
      if (e.notes) lines.push(`  Note: ${e.notes}`);
    }
    if (w.notes) lines.push(`Session note: ${w.notes}`);
  }
  if (!lines.length) lines.push('Nothing saved online yet.');
  return lines;
}
