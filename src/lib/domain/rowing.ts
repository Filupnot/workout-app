export function deriveRow(input: { seconds?: number; meters?: number; split?: number }) {
  let { seconds, meters, split } = input;
  const provided = [seconds, meters, split].filter(v => v !== undefined);
  if (provided.length < 2) throw new Error('Enter any two of time, distance, and split.');
  if (provided.some(v => !Number.isFinite(v) || v! <= 0)) throw new Error('Rowing values must be positive numbers.');
  if (seconds !== undefined && meters !== undefined) {
    const derived = 500 * seconds / meters;
    // A displayed split is rounded to a whole second.
    if (split !== undefined && Math.abs(derived - split) > 1) throw new Error('These results disagree. Keep two values to calculate the third.');
    split = derived;
  } else if (seconds !== undefined && split !== undefined) meters = 500 * seconds / split;
  else if (meters !== undefined && split !== undefined) seconds = meters * split / 500;
  return { seconds: seconds!, meters: meters!, split: split! };
}
export function weightInKg(weight: number, unit: 'lb' | 'kg') {
  if (!Number.isFinite(weight) || weight < 0) throw new Error('Invalid weight.');
  return unit === 'kg' ? weight : weight * 0.45359237;
}
export function formatTime(seconds: number) {
  const rounded = Math.round(Math.abs(seconds));
  return `${seconds < 0 ? '-' : ''}${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}
export function parseTime(value: string): number | undefined {
  if (!value.trim()) return undefined;
  if (!/^\d+(?::[0-5]\d)?$/.test(value.trim())) throw new Error('Use seconds or m:ss.');
  const parts = value.split(':').map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
}
