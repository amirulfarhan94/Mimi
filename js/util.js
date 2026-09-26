// General utilities: dates, money, HTML escaping, IDs.

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

const rmFmt = new Intl.NumberFormat('ms-MY', {
  style: 'currency', currency: 'MYR', minimumFractionDigits: 2,
});
export const rm = (n) => rmFmt.format(Number(n) || 0);

const pad = (n) => String(n).padStart(2, '0');

/** Local date as YYYY-MM-DD. */
export const toISO = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const today = () => toISO(new Date());

/** Parse YYYY-MM-DD as a local date (at noon, to dodge DST issues). */
export const parseISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

export const addDays = (iso, n) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

/** Add months, keeping the day where possible (31 Jan + 1 month = 28/29 Feb). */
export const addMonths = (iso, n) => {
  const d = parseISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
};

export const daysBetween = (a, b) =>
  Math.round((parseISO(b) - parseISO(a)) / 86400000);

export const monthKey = (iso) => iso.slice(0, 7);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const fmtDate = (iso) => {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

export const fmtDateLong = (iso) => {
  const d = parseISO(iso);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
};

export const fmtDay = (iso) => DAYS[parseISO(iso).getDay()];
export const fmtShortDay = (iso) => DAYS[parseISO(iso).getDay()].slice(0, 3);

export const fmtMonth = (key) => {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS_FULL[m - 1]} ${y}`;
};

export const shiftMonth = (key, n) => addMonths(`${key}-01`, n).slice(0, 7);

/** "Today", "Tomorrow", "In 3 days", "2 days ago". */
export const relDays = (iso, from = today()) => {
  const n = daysBetween(from, iso);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n > 0 ? `In ${n} days` : `${-n} days ago`;
};

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Money for stat tiles: small "RM" that may wrap before the number (never truncates the value). */
export const rmStat = (n) => rm(n).replace(/RM[\s ]*/, '<small>RM</small> ');
