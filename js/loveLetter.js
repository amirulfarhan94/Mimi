// Mimi Love Letter logic: one letter per day — which letter belongs to a date, and special-date overrides.
// Everything runs locally from bundled data — no network needed.
import { LOVE_LETTERS, SIGNATURE } from './data/loveLetters.js';
import { SPECIAL_DATES } from './data/specialLetters.js';
import { DATE_OVERRIDES } from './data/letterOverrides.js';
import { toISO } from './util.js';

// Days before each month in a NON-leap year, so 1 March is always day 60 and 31 December day 365.
const DAYS_BEFORE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/**
 * Letter number (1–365) for a date, using the device's local calendar date.
 * 1 Jan → 1 … 31 Dec → 365 in every year. 29 February (leap years only) gets a
 * "bonus" letter picked from the year, so it is stable all day and never repeats
 * the letters of 28 Feb (59) or 1 Mar (60).
 */
export function letterNumber(date = new Date()) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if (m === 2 && d === 29) {
    const n = ((date.getFullYear() * 97) % 365) + 1;
    return n >= 58 && n <= 61 ? n + 100 : n;
  }
  return DAYS_BEFORE[m - 1] + d;
}

/** Special occasion for a date (birthday / anniversary), or null. */
export const specialFor = (date = new Date()) =>
  SPECIAL_DATES.find((s) => s.month === date.getMonth() + 1 && s.day === date.getDate()) || null;

/** Letter number picked by hand for this exact date (js/data/letterOverrides.js), or null. */
function overrideFor(date) {
  const n = Number(DATE_OVERRIDES[toISO(date)]);
  return Number.isInteger(n) && n >= 1 && n <= LOVE_LETTERS.length ? n : null;
}

/**
 * The one note for a date. Special dates take priority, then a hand-picked letter for that
 * exact date, then the normal daily letter.
 * On a special date with several messages, one is chosen per year (rotating).
 * → { kind: 'special', occasion, text, signature } | { kind: 'daily', number, category, text, signature }
 */
export function noteFor(date = new Date()) {
  const occasion = specialFor(date);
  if (occasion && occasion.messages.length) {
    const msg = occasion.messages[date.getFullYear() % occasion.messages.length];
    return { kind: 'special', occasion, text: msg.text, signature: msg.signature };
  }
  const number = overrideFor(date) ?? letterNumber(date);
  const letter = LOVE_LETTERS[number - 1];
  return { kind: 'daily', number, category: letter.category, text: letter.text, signature: SIGNATURE };
}
