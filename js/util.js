// Utiliti am: tarikh, wang, HTML escaping, ID.

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

/** Tarikh tempatan dalam format YYYY-MM-DD. */
export const toISO = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const today = () => toISO(new Date());

/** Parse YYYY-MM-DD sebagai tarikh tempatan (tengah hari, elak isu DST). */
export const parseISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

export const addDays = (iso, n) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

/** Tambah bulan, kekalkan hari asal jika boleh (31 Jan + 1 bulan = 28/29 Feb). */
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

const BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
const BULAN_PENUH = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
const HARI = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];

export const fmtDate = (iso) => {
  const d = parseISO(iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};

export const fmtDateLong = (iso) => {
  const d = parseISO(iso);
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN_PENUH[d.getMonth()]} ${d.getFullYear()}`;
};

export const fmtDay = (iso) => HARI[parseISO(iso).getDay()];
export const fmtShortDay = (iso) => HARI[parseISO(iso).getDay()].slice(0, 3);

export const fmtMonth = (key) => {
  const [y, m] = key.split('-').map(Number);
  return `${BULAN_PENUH[m - 1]} ${y}`;
};

export const shiftMonth = (key, n) => addMonths(`${key}-01`, n).slice(0, 7);

/** "Hari ini", "Esok", "Dalam 3 hari", "2 hari lepas". */
export const relDays = (iso, from = today()) => {
  const n = daysBetween(from, iso);
  if (n === 0) return 'Hari ini';
  if (n === 1) return 'Esok';
  if (n === -1) return 'Semalam';
  return n > 0 ? `Dalam ${n} hari` : `${-n} hari lepas`;
};

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Wang untuk jubin statistik: "RM" kecil, boleh balut sebelum nombor (tanpa potong nilai). */
export const rmStat = (n) => rm(n).replace(/RM[\s ]*/, '<small>RM</small> ');
