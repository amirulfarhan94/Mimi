// Weight tracker logic: one weigh-in per day (kg, 1 decimal), trends, goal and BMI.
// Pure helpers take the list of entries so they are easy to test; the store helpers write to state.
import { getState, update } from './store.js';
import { addDays, daysBetween } from './util.js';

export const MIN_KG = 20;
export const MAX_KG = 300;

const DEFAULTS = {
  goalKg: null,          // target weight (kg) or null
  goalStartKg: null,     // weight when the goal was set — progress is measured from here
  goalDate: '',          // optional target date (YYYY-MM-DD)
  heightCm: null,        // for BMI
  reminder: { on: true, time: '07:00' },   // daily weigh-in push reminder (only once she has logged a weight)
  gentle: true,          // soft colours & wording
};

export const round1 = (n) => Math.round(Number(n) * 10) / 10;
export const kg = (n) => `${round1(n).toFixed(1)} kg`;

/** Settings with defaults filled in. */
export function weightSettings(state = getState()) {
  const s = state.weightSettings || {};
  return { ...DEFAULTS, ...s, reminder: { ...DEFAULTS.reminder, ...(s.reminder || {}) } };
}

/** Entries sorted oldest → newest. */
export const entries = (state = getState()) => [...(state.weights || [])].sort((a, b) => a.date.localeCompare(b.date));

export const entryOn = (list, date) => list.find((e) => e.date === date);

/** The latest entry on or before `date` (list sorted oldest → newest). */
export function entryAtOrBefore(list, date) {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].date <= date) return list[i];
  return null;
}

/** Entry just before the given one. */
export function previousEntry(list, date) {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].date < date) return list[i];
  return null;
}

/** Average of the weigh-ins in the 7 days ending on `date` (null if none). */
export function avg7(list, date) {
  const from = addDays(date, -6);
  const w = list.filter((e) => e.date >= from && e.date <= date);
  return w.length ? w.reduce((a, e) => a + e.kg, 0) / w.length : null;
}

/** Summary numbers. Changes compare the latest weigh-in with the one ~7 / ~30 days earlier. */
export function stats(list) {
  if (!list.length) return null;
  const latest = list[list.length - 1];
  const first = list[0];
  const diffFrom = (days) => {
    const ref = entryAtOrBefore(list, addDays(latest.date, -days));
    return ref && ref !== latest ? round1(latest.kg - ref.kg) : null;
  };
  let low = first, high = first;
  for (const e of list) { if (e.kg < low.kg) low = e; if (e.kg > high.kg) high = e; }
  const prev = previousEntry(list, latest.date);
  return {
    latest, first, low, high,
    change: prev ? round1(latest.kg - prev.kg) : null,   // vs the previous weigh-in
    week: diffFrom(7),
    month: diffFrom(30),
    sinceStart: list.length > 1 ? round1(latest.kg - first.kg) : null,
    count: list.length,
  };
}

// ---------- BMI (Malaysian / Asian cut-offs) ----------
export function bmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/** BMI band. Gentle mode uses softer names. */
export function bmiBand(value, gentle = true) {
  if (value == null) return null;
  if (value < 18.5) return { key: 'under', label: gentle ? 'Below the healthy range' : 'Underweight' };
  if (value < 23) return { key: 'healthy', label: gentle ? 'Healthy range' : 'Healthy weight' };
  if (value < 27.5) return { key: 'over', label: gentle ? 'A little above the healthy range' : 'Overweight' };
  return { key: 'high', label: gentle ? 'Above the healthy range' : 'Obese' };
}

/** Healthy weight range (kg) for a height, from BMI 18.5–22.9. */
export function healthyRange(heightCm) {
  if (!heightCm) return null;
  const m2 = (heightCm / 100) ** 2;
  return [round1(18.5 * m2), round1(22.9 * m2)];
}

// ---------- Goal ----------
/**
 * Progress toward the goal. direction: 'down' (lose), 'up' (gain) or 'keep'.
 * pct 0–1 measured from the weight when the goal was set.
 */
export function goalProgress(settings, latestKg, now) {
  const goal = settings.goalKg;
  if (goal == null || latestKg == null) return null;
  const start = settings.goalStartKg ?? latestKg;
  const direction = goal < start ? 'down' : goal > start ? 'up' : 'keep';
  const left = round1(Math.abs(latestKg - goal));
  let reached, pct;
  if (direction === 'down') { reached = latestKg <= goal; pct = (start - latestKg) / (start - goal); }
  else if (direction === 'up') { reached = latestKg >= goal; pct = (latestKg - start) / (goal - start); }
  else { reached = left <= 0.5; pct = reached ? 1 : 0; }
  pct = Math.max(0, Math.min(1, reached ? 1 : pct));
  let daysLeft = null, perWeek = null;
  if (settings.goalDate && now) {
    daysLeft = daysBetween(now, settings.goalDate);
    if (!reached && daysLeft > 0) perWeek = round1((left / daysLeft) * 7);
  }
  return { goal, start, direction, left, reached, pct, daysLeft, perWeek };
}

/**
 * How a change should look. 'good' / 'bad' only when gentle mode is off and a goal gives a direction;
 * otherwise 'neutral' (no red for ups).
 */
export function changeTone(diff, settings, direction) {
  if (!diff || settings.gentle || !direction || direction === 'keep') return 'neutral';
  return (direction === 'down' ? diff < 0 : diff > 0) ? 'good' : 'bad';
}

/** "▼ 0.6 kg" / "▲ 0.4 kg" / "No change". */
export function fmtChange(diff) {
  if (diff == null) return '—';
  if (Math.abs(diff) < 0.05) return 'No change';
  return `${diff < 0 ? '▼' : '▲'} ${Math.abs(diff).toFixed(1)} kg`;
}

// ---------- Store helpers ----------
/** Save (or replace) the weigh-in for a date. */
export function logWeight(date, kgValue, note = '') {
  update((s) => {
    s.weights = (s.weights || []).filter((e) => e.date !== date);
    s.weights.push({ date, kg: round1(kgValue), note: note.trim() });
    s.weights.sort((a, b) => a.date.localeCompare(b.date));
    // Goal set before the first weigh-in: measure progress from this one.
    if (s.weightSettings?.goalKg != null && s.weightSettings.goalStartKg == null) s.weightSettings.goalStartKg = round1(kgValue);
  });
}

export function deleteWeight(date) {
  update((s) => { s.weights = (s.weights || []).filter((e) => e.date !== date); });
}

/** Merge settings. A new / changed goal starts measuring progress from the latest weight. */
export function saveWeightSettings(patch) {
  update((s) => {
    const cur = weightSettings(s);
    const next = { ...cur, ...patch, reminder: { ...cur.reminder, ...(patch.reminder || {}) } };
    if (next.goalKg == null) { next.goalStartKg = null; next.goalDate = ''; }
    else if (next.goalKg !== cur.goalKg || cur.goalStartKg == null) {
      const list = entries(s);
      next.goalStartKg = list.length ? list[list.length - 1].kg : null;
    }
    s.weightSettings = next;
  });
}
