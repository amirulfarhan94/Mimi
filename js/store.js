// Simpanan data tempatan (localStorage). Semua data kekal dalam peranti pengguna.
import { uid } from './util.js';

const KEY = 'mimi:data:v1';

const empty = () => ({
  version: 1,
  notes: [],   // { id, date, mood, title, body, createdAt, updatedAt }
  txns: [],    // { id, type: 'out'|'in', amount, category, date, note, link?: { kutuId, round, kind } }
  kutu: [],    // lihat js/kutu.js
  settings: { name: '' },
});

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...JSON.parse(raw) };
  } catch {
    return empty();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Gagal simpan data', e);
  }
  listeners.forEach((fn) => fn(state));
}

export const getState = () => state;
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));

/** Ubah state melalui fungsi mutasi, kemudian simpan. */
export function update(mutator) {
  mutator(state);
  persist();
}

// ---------- CRUD generik ----------
export function upsert(collection, item) {
  update((s) => {
    const list = s[collection];
    const now = new Date().toISOString();
    if (item.id) {
      const i = list.findIndex((x) => x.id === item.id);
      if (i >= 0) list[i] = { ...list[i], ...item, updatedAt: now };
      else list.push({ ...item, createdAt: now, updatedAt: now });
    } else {
      list.push({ ...item, id: uid(), createdAt: now, updatedAt: now });
    }
  });
}

export function remove(collection, id) {
  update((s) => {
    s[collection] = s[collection].filter((x) => x.id !== id);
  });
}

export function find(collection, id) {
  return state[collection].find((x) => x.id === id);
}

// ---------- Sandaran ----------
export function exportJSON() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

export function importJSON(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.notes) || !Array.isArray(data.txns) || !Array.isArray(data.kutu)) {
    throw new Error('Fail sandaran tidak sah');
  }
  delete data.exportedAt;
  state = { ...empty(), ...data };
  persist();
}

export function resetAll() {
  state = empty();
  persist();
}
