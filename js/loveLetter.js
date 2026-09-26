// Mimi Love Letter logic: which letter belongs to a date, special-date overrides and "Another Note".
// Everything runs locally from bundled data — no network needed.
import { LOVE_LETTERS, SIGNATURE } from './data/loveLetters.js';
import { SPECIAL_DATES } from './data/specialLetters.js';

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

/**
 * Today's primary note. Special dates take priority over the normal daily letter.
 * On a special date with several messages, one is chosen per year (rotating).
 * → { kind: 'special', occasion, text, signature } | { kind: 'daily', number, category, text, signature }
 */
export function noteFor(date = new Date()) {
  const occasion = specialFor(date);
  if (occasion && occasion.messages.length) {
    const msg = occasion.messages[date.getFullYear() % occasion.messages.length];
    return { kind: 'special', occasion, text: msg.text, signature: msg.signature };
  }
  const number = letterNumber(date);
  const letter = LOVE_LETTERS[number - 1];
  return { kind: 'daily', number, category: letter.category, text: letter.text, signature: SIGNATURE };
}

/**
 * Source of "Another Note" letters for one popup session. The day's primary note
 * is never changed; extra notes come from the rest of the collection in shuffled
 * order (the occasion's other messages first on a special date), never showing
 * the same words twice in a row.
 */
export function anotherNotes(primary) {
  const extras = primary.kind === 'special'
    ? primary.occasion.messages
      .filter((m) => m.text !== primary.text)
      .map((m) => ({ kind: 'special', occasion: primary.occasion, text: m.text, signature: m.signature }))
    : [];
  let deck = [];
  let last = primary.text;

  const refill = () => {
    deck = LOVE_LETTERS
      .filter((l) => l.text !== primary.text)
      .map((l) => ({ kind: 'daily', number: l.day, category: l.category, text: l.text, signature: SIGNATURE }));
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  };

  return function next() {
    if (extras.length) {
      const note = extras.shift();
      last = note.text;
      return note;
    }
    let note;
    do {
      if (!deck.length) refill();
      note = deck.pop();
    } while (note.text === last && deck.length);
    last = note.text;
    return note;
  };
}
