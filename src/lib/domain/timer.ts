export type RestTimer = { deadline: number; consumed: boolean; hiddenAt?: number };
export const startRest = (seconds = 90, now = Date.now()): RestTimer => ({ deadline: now + seconds * 1000, consumed: false });
export function remaining(timer: RestTimer, now = Date.now()) { return Math.ceil((timer.deadline - now) / 1000); }
export function tick(timer: RestTimer, now: number, visible: boolean, sound: boolean) {
  const due = now >= timer.deadline;
  const missed = timer.hiddenAt !== undefined && timer.hiddenAt <= timer.deadline;
  return { timer: due ? { ...timer, consumed: true } : timer,
    cue: due && !timer.consumed && visible && sound && !missed && now - timer.deadline < 1500 };
}
export function visibility(timer: RestTimer, visible: boolean, now = Date.now()): RestTimer {
  if (!visible) return { ...timer, hiddenAt: now };
  return { ...timer, consumed: timer.consumed || now >= timer.deadline, hiddenAt: undefined };
}
/** Shift the running deadline; a deadline moved back into the future can cue again. */
export function adjust(timer: RestTimer, seconds: number, now = Date.now()): RestTimer {
  const deadline = Math.max(now, timer.deadline + seconds * 1000);
  return { ...timer, deadline, consumed: deadline > now ? false : timer.consumed };
}
