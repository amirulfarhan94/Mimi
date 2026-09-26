// Mimi Love Letter — hand-picked letters for specific dates.
// Key: the date on the phone (YYYY-MM-DD). Value: a letter number from js/data/loveLetters.js (1–365).
// Only that exact date changes; every other day keeps its normal letter.
// Special dates (birthdays, anniversary) still take priority.
// After editing, bump VERSION in sw.js so installed apps pick up the change.

export const DATE_OVERRIDES = {
  '2026-09-26': 2, // "Thank you for all the little things you do…"
};
