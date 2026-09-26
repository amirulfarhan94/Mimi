// Weight: daily weigh-ins, trend chart with a 7-day average, goal, BMI and gentle mode.
import { getState } from '../store.js';
import { esc, today, addDays, daysBetween, fmtDate, fmtDateLong, relDays, parseISO } from '../util.js';
import { openSheet, confirmSheet, toast, formData, icon } from '../ui.js';
import {
  MIN_KG, MAX_KG, round1, kg, weightSettings, entries, entryOn, previousEntry, avg7, stats,
  bmi, bmiBand, healthyRange, goalProgress, changeTone, fmtChange, logWeight, deleteWeight, saveWeightSettings,
} from '../weight.js';
import { pushConfigured, pushOn } from '../reminders.js';

const RANGES = [['7', '7D'], ['30', '30D'], ['90', '3M'], ['all', 'All']];
const GENTLE_UP = 'Small ups and downs are normal 💕';
let range = '30';
let showAll = false;

const tone = (diff, set, dir) => `wt-${changeTone(diff, set, dir)}`;
const shortDate = (iso) => { const d = parseISO(iso); return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`; };

// ---------- Chart ----------
const W = 340, H = 196, ML = 36, MR = 12, MT = 14, MB = 26;

function niceStep(span) {
  for (const s of [0.2, 0.5, 1, 2, 5, 10, 20]) if (span / s <= 5) return s;
  return 50;
}

/** Line chart: daily weigh-ins (dots), 7-day average (line) and goal (dashed). */
function chart(list, set) {
  const now = today();
  const from = range === 'all' ? (list[0] && list[0].date < addDays(now, -6) ? list[0].date : addDays(now, -6)) : addDays(now, -(+range - 1));
  const pts = list.filter((e) => e.date >= from && e.date <= now);
  if (!pts.length) return `<p class="muted small wt-empty-chart">No weigh-ins in this period yet.</p>`;

  const span = Math.max(1, daysBetween(from, now));
  const avgs = pts.map((e) => avg7(list, e.date));
  const vals = [...pts.map((e) => e.kg), ...avgs];
  let lo = Math.min(...vals), hi = Math.max(...vals);
  // Show the goal line when it is reasonably close; otherwise just mention it.
  const goal = set.goalKg;
  const goalNear = goal != null && goal >= lo - Math.max(2, hi - lo) && goal <= hi + Math.max(2, hi - lo);
  if (goalNear) { lo = Math.min(lo, goal); hi = Math.max(hi, goal); }
  if (hi - lo < 1) { const mid = (hi + lo) / 2; lo = mid - 0.5; hi = mid + 0.5; }
  const step = niceStep(hi - lo);
  lo = Math.floor((lo - step * 0.25) / step) * step;
  hi = Math.ceil((hi + step * 0.25) / step) * step;

  const x = (d) => ML + (daysBetween(from, d) / span) * (W - ML - MR);
  const y = (v) => MT + ((hi - v) / (hi - lo)) * (H - MT - MB);
  const f = (n) => n.toFixed(1);

  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(round1(v));
  const xLabels = range === '7'
    ? Array.from({ length: 7 }, (_, i) => addDays(now, i - 6))
    : [0, 1 / 3, 2 / 3, 1].map((p) => addDays(from, Math.round(span * p)));

  const dailyPath = pts.map((e, i) => `${i ? 'L' : 'M'}${f(x(e.date))},${f(y(e.kg))}`).join('');
  const avgPath = pts.map((e, i) => `${i ? 'L' : 'M'}${f(x(e.date))},${f(y(avgs[i]))}`).join('');
  const data = pts.map((e, i) => ({ x: +f(x(e.date)), y: +f(y(e.kg)), ay: +f(y(avgs[i])), d: e.date, kg: e.kg, avg: round1(avgs[i]) }));

  return `
    <div class="wt-legend" aria-hidden="true">
      <span><i class="lg-dot"></i>Daily</span>
      <span><i class="lg-line"></i>7-day average</span>
      ${goal != null ? `<span><i class="lg-goal"></i>Goal ${kg(goal)}${goalNear ? '' : goal < lo ? ' ↓' : ' ↑'}</span>` : ''}
    </div>
    <div class="wt-chart" data-points='${JSON.stringify(data)}'>
      <svg viewBox="0 0 ${W} ${H}" role="img" tabindex="0" aria-label="Weight chart. Use the arrow keys to read each weigh-in.">
        ${ticks.map((v) => `<line class="wt-grid" x1="${ML}" x2="${W - MR}" y1="${f(y(v))}" y2="${f(y(v))}"/>
          <text class="wt-axis" x="${ML - 6}" y="${f(y(v) + 3.5)}" text-anchor="end">${step < 1 ? v.toFixed(1) : v}</text>`).join('')}
        ${xLabels.map((d, i) => `<text class="wt-axis" x="${f(x(d))}" y="${H - 8}" text-anchor="${i === 0 && range !== '7' ? 'start' : i === xLabels.length - 1 && range !== '7' ? 'end' : 'middle'}">${range === '7' ? parseISO(d).toLocaleString('en-GB', { weekday: 'short' }) : shortDate(d)}</text>`).join('')}
        ${goalNear ? `<line class="wt-goal" x1="${ML}" x2="${W - MR}" y1="${f(y(goal))}" y2="${f(y(goal))}"/>` : ''}
        ${pts.length > 1 ? `<path class="wt-daily" d="${dailyPath}"/>` : ''}
        ${pts.map((e) => `<circle class="wt-dot" cx="${f(x(e.date))}" cy="${f(y(e.kg))}" r="${pts.length > 45 ? 2.2 : 3.2}"/>`).join('')}
        ${pts.length > 1 ? `<path class="wt-avg" d="${avgPath}"/>` : ''}
        <g class="wt-focus" hidden>
          <line class="wt-guide" y1="${MT}" y2="${H - MB}"/>
          <circle class="wt-hi-avg" r="3.5"/>
          <circle class="wt-hi" r="5"/>
        </g>
        <rect class="wt-hit" x="${ML}" y="0" width="${W - ML - MR}" height="${H}"/>
      </svg>
      <div class="wt-tip" hidden></div>
    </div>
    <table class="sr-only"><caption>Weigh-ins</caption>
      <tr><th>Date</th><th>Weight</th><th>7-day average</th></tr>
      ${data.slice(-31).map((p) => `<tr><td>${fmtDate(p.d)}</td><td>${kg(p.kg)}</td><td>${kg(p.avg)}</td></tr>`).join('')}</table>`;
}

function bindChart(root) {
  const wrap = root.querySelector('.wt-chart');
  if (!wrap) return;
  const pts = JSON.parse(wrap.dataset.points);
  const svg = wrap.querySelector('svg');
  const focus = svg.querySelector('.wt-focus');
  const tip = wrap.querySelector('.wt-tip');
  let cur = -1;
  const show = (i) => {
    cur = Math.max(0, Math.min(pts.length - 1, i));
    const p = pts[cur];
    focus.hidden = false;
    focus.querySelector('.wt-guide').setAttribute('x1', p.x);
    focus.querySelector('.wt-guide').setAttribute('x2', p.x);
    const hi = focus.querySelector('.wt-hi'); hi.setAttribute('cx', p.x); hi.setAttribute('cy', p.y);
    const ha = focus.querySelector('.wt-hi-avg'); ha.setAttribute('cx', p.x); ha.setAttribute('cy', p.ay); ha.toggleAttribute('hidden', pts.length < 2);
    tip.hidden = false;
    tip.innerHTML = `<b>${kg(p.kg)}</b><span>${fmtDate(p.d)}</span>${pts.length > 1 ? `<span>7-day avg ${kg(p.avg)}</span>` : ''}`;
    const px = p.x / W;
    tip.style.left = `${px * 100}%`;
    tip.style.top = `${(Math.min(p.y, p.ay) / H) * 100}%`;
    tip.dataset.edge = px < 0.25 ? 'left' : px > 0.75 ? 'right' : '';
  };
  const hide = () => { focus.hidden = true; tip.hidden = true; };
  const nearest = (clientX) => {
    const r = svg.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * W;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(p.x - sx) < Math.abs(pts[best].x - sx)) best = i; });
    return best;
  };
  svg.addEventListener('pointermove', (e) => show(nearest(e.clientX)));
  svg.addEventListener('pointerdown', (e) => show(nearest(e.clientX)));
  svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  svg.addEventListener('focus', () => show(cur < 0 ? pts.length - 1 : cur));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); show(cur + (e.key === 'ArrowLeft' ? -1 : 1)); }
    if (e.key === 'Escape') hide();
  });
}

// ---------- Pieces shared with the dashboard ----------
function sparkline(list) {
  const from = addDays(today(), -29);
  const pts = list.filter((e) => e.date >= from);
  if (pts.length < 2) return '';
  const w = 96, h = 32, lo = Math.min(...pts.map((e) => e.kg)), hi = Math.max(...pts.map((e) => e.kg));
  const span = Math.max(1, daysBetween(pts[0].date, pts[pts.length - 1].date));
  const d = pts.map((e, i) => `${i ? 'L' : 'M'}${(2 + (daysBetween(pts[0].date, e.date) / span) * (w - 4)).toFixed(1)},${(hi === lo ? h / 2 : 3 + ((hi - e.kg) / (hi - lo)) * (h - 6)).toFixed(1)}`).join('');
  return `<svg class="wt-spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}"/></svg>`;
}

/** Dashboard card. */
export function weightCard() {
  const list = entries();
  const set = weightSettings();
  const now = today();
  const st = stats(list);
  const todays = entryOn(list, now);
  const head = `<div class="row between"><h3 class="card-title">⚖️ Weight</h3><a class="link" href="#/weight">See all</a></div>`;
  if (!todays) {
    return `<section class="card">${head}
      <button class="prompt" data-q="weight"><span>⚖️</span><span class="grow"><b>Log today’s weight</b><br>
      <span class="small muted">${st ? `Last: ${kg(st.latest.kg)} · ${relDays(st.latest.date).toLowerCase()}` : 'Start tracking — it only takes a few seconds.'}</span></span>${icon('right')}</button>
    </section>`;
  }
  const g = goalProgress(set, st.latest.kg, now);
  const diff = st.week ?? st.change;
  return `<section class="card">${head}
    <a class="wt-mini" href="#/weight">
      <span class="grow">
        <span class="wt-mini-kg">${round1(todays.kg).toFixed(1)}<small> kg</small></span>
        <span class="small ${tone(diff, set, g?.direction)}">${diff == null ? 'Logged today 💕' : `${fmtChange(diff)} ${st.week != null ? 'this week' : 'since last time'}`}</span>
        ${g ? `<span class="small muted">${g.reached ? 'Goal reached 🎉' : `${g.left.toFixed(1)} kg to your goal`}</span>` : ''}
      </span>
      ${sparkline(list)}
    </a>
  </section>`;
}

// ---------- Forms ----------
export function openWeightForm(date = today()) {
  const list = entries();
  const existing = entryOn(list, date);
  const last = list[list.length - 1];
  const start = existing?.kg ?? last?.kg ?? '';
  openSheet({
    title: existing ? 'Edit weight' : 'Log weight',
    body: `
      <form class="form" id="weightForm" novalidate>
        <label class="field"><span>Date</span>
          <input name="date" type="date" required max="${today()}" value="${esc(date)}">
        </label>
        <div class="field amount-field">
          <span class="label" id="kgLabel">Weight (kg)</span>
          <div class="wt-stepper">
            <button type="button" class="icon-btn" data-step="-0.1" aria-label="Minus 0.1 kg">−</button>
            <input name="kg" type="number" inputmode="decimal" step="0.1" min="${MIN_KG}" max="${MAX_KG}" required
              value="${start === '' ? '' : round1(start).toFixed(1)}" placeholder="e.g. 58.5" aria-labelledby="kgLabel">
            <button type="button" class="icon-btn" data-step="0.1" aria-label="Plus 0.1 kg">+</button>
          </div>
        </div>
        <label class="field"><span>Note (optional)</span>
          <input name="note" maxlength="120" value="${esc(existing?.note || '')}" placeholder="e.g. After breakfast">
        </label>
        <p class="hint" id="wtReplace" ${existing ? '' : 'hidden'}>This replaces the weight saved for that day.</p>
        <p class="hint wt-error" id="wtError" hidden></p>
        <div class="row gap mt">
          ${existing ? `<button type="button" class="btn ghost danger-text" data-del>${icon('trash')} Delete</button>` : ''}
          <button class="btn primary grow" type="submit">${icon('check')} Save</button>
        </div>
      </form>`,
    onMount(root, close) {
      const form = root.querySelector('#weightForm');
      const err = root.querySelector('#wtError');
      form.addEventListener('input', () => { err.hidden = true; });
      root.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
        const v = parseFloat(form.kg.value) || parseFloat(start) || 50;
        form.kg.value = round1(Math.min(MAX_KG, Math.max(MIN_KG, v + +b.dataset.step))).toFixed(1);
      }));
      form.date.addEventListener('change', () => {
        const e = entryOn(entries(), form.date.value);
        root.querySelector('#wtReplace').hidden = !e;
        if (e) { form.kg.value = e.kg.toFixed(1); form.note.value = e.note || ''; }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const d = formData(form);
        const v = parseFloat(String(d.kg).replace(',', '.'));
        const fail = (m) => { err.textContent = m; err.hidden = false; };
        if (!d.date) return fail('Please choose a date.');
        if (d.date > today()) return fail('The date can’t be in the future.');
        if (!Number.isFinite(v) || v < MIN_KG || v > MAX_KG) return fail(`Please enter a weight between ${MIN_KG} and ${MAX_KG} kg.`);
        const prev = previousEntry(entries(), d.date);
        logWeight(d.date, v, d.note || '');
        close();
        const up = prev && round1(v) > prev.kg;
        toast(weightSettings().gentle && up ? `Saved. ${GENTLE_UP}` : 'Weight saved 💕');
      });
      root.querySelector('[data-del]')?.addEventListener('click', async () => {
        close();
        if (await confirmSheet(`Delete the weight for ${fmtDate(date)}?`)) { deleteWeight(date); toast('Weight deleted'); }
      });
    },
  });
}

function openWeightSettings() {
  const set = weightSettings();
  const pushOff = pushConfigured() && !pushOn();
  openSheet({
    title: 'Goal & settings',
    body: `
      <form class="form" id="wtSettings" novalidate>
        <div class="wt-two">
          <label class="field"><span>Goal weight (kg)</span>
            <input name="goalKg" type="number" inputmode="decimal" step="0.1" min="${MIN_KG}" max="${MAX_KG}" value="${set.goalKg ?? ''}" placeholder="Optional">
          </label>
          <label class="field"><span>By (optional)</span>
            <input name="goalDate" type="date" min="${addDays(today(), 1)}" value="${esc(set.goalDate)}">
          </label>
        </div>
        <label class="field"><span>Height (cm) — for BMI</span>
          <input name="heightCm" type="number" inputmode="numeric" step="1" min="100" max="250" value="${set.heightCm ?? ''}" placeholder="e.g. 158">
        </label>
        <div class="field">
          <span class="label">Daily reminder</span>
          <div class="row gap wt-remind">
            <label class="check grow"><input type="checkbox" name="remind" ${set.reminder.on ? 'checked' : ''}><span>Remind me to weigh in</span></label>
            <input name="time" type="time" value="${esc(set.reminder.time)}" aria-label="Reminder time" class="time-input">
          </div>
          <p class="hint">Only on days you haven’t logged yet. The weight itself is never sent.${pushOff ? ' <a class="link" href="#/settings" data-close>Turn on reminders in Settings</a> to get it on your phone.' : ''}</p>
        </div>
        <label class="check"><input type="checkbox" name="gentle" ${set.gentle ? 'checked' : ''}>
          <span><b>Gentle mode</b><br><span class="small muted">Soft colours and kind words — no red for small ups.</span></span></label>
        <p class="hint wt-error" id="wsError" hidden></p>
        <div class="row gap mt">
          ${set.goalKg != null ? '<button type="button" class="btn ghost" data-clear-goal>Remove goal</button>' : ''}
          <button class="btn primary grow" type="submit">${icon('check')} Save</button>
        </div>
      </form>`,
    onMount(root, close) {
      const form = root.querySelector('#wtSettings');
      const err = root.querySelector('#wsError');
      form.addEventListener('input', () => { err.hidden = true; });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const d = formData(form);
        const fail = (m) => { err.textContent = m; err.hidden = false; };
        const goal = d.goalKg === '' ? null : parseFloat(String(d.goalKg).replace(',', '.'));
        const height = d.heightCm === '' ? null : parseFloat(d.heightCm);
        if (goal != null && !(goal >= MIN_KG && goal <= MAX_KG)) return fail(`Goal must be between ${MIN_KG} and ${MAX_KG} kg.`);
        if (height != null && !(height >= 100 && height <= 250)) return fail('Height must be between 100 and 250 cm.');
        if (d.goalDate && d.goalDate <= today()) return fail('The goal date should be in the future.');
        saveWeightSettings({
          goalKg: goal == null ? null : round1(goal), goalDate: goal == null ? '' : d.goalDate || '',
          heightCm: height == null ? null : Math.round(height),
          reminder: { on: !!d.remind, time: d.time || '07:00' }, gentle: !!d.gentle,
        });
        close();
        toast('Saved 💕');
      });
      root.querySelector('[data-clear-goal]')?.addEventListener('click', () => {
        saveWeightSettings({ goalKg: null });
        close();
        toast('Goal removed');
      });
    },
  });
}

// ---------- Page ----------
function goalBlock(g, set, now) {
  if (!g) return `<button class="btn sm wt-add" data-settings>🎯 Set a goal</button>`;
  const verb = g.direction === 'up' ? 'to gain' : g.direction === 'down' ? 'to go' : 'from your goal';
  let when = '';
  if (set.goalDate && !g.reached) {
    when = g.daysLeft > 0
      ? `By ${fmtDate(set.goalDate)} · about ${g.perWeek.toFixed(1)} kg a week`
      : `Target date ${fmtDate(set.goalDate)} has passed — ${set.gentle ? 'every step still counts 💕' : 'set a new date?'}`;
  }
  return `<div class="wt-goal-box">
    <div class="row between small"><span><b>🎯 Goal ${kg(g.goal)}</b></span><span class="muted">${g.reached ? 'Reached 🎉' : `${Math.round(g.pct * 100)}%`}</span></div>
    <div class="wt-progress" role="progressbar" aria-label="Goal progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(g.pct * 100)}"><span style="width:${(g.pct * 100).toFixed(1)}%"></span></div>
    <p class="small ${g.reached ? 'wt-good-text' : 'muted'}">${g.reached ? `You did it, Sayang! Goal reached 🎉` : `${g.left.toFixed(1)} kg ${verb}${g.direction === 'keep' ? '' : ` · started at ${kg(g.start)}`}`}</p>
    ${when ? `<p class="small muted">${when}</p>` : ''}
  </div>`;
}

function bmiBlock(latestKg, set) {
  if (!set.heightCm) return `<button class="btn sm ghost wt-add" data-settings>📏 Add your height for BMI</button>`;
  const v = bmi(latestKg, set.heightCm);
  const band = bmiBand(v, set.gentle);
  const [a, b] = healthyRange(set.heightCm);
  return `<div class="wt-bmi">
    <span class="pill ${band.key === 'healthy' ? 'ok-text' : ''}">BMI ${v.toFixed(1)}</span>
    <span class="small">${band.label}</span>
    <p class="hint">Healthy range for ${set.heightCm} cm: ${a.toFixed(1)}–${b.toFixed(1)} kg (Malaysian guideline).</p>
  </div>`;
}

export default {
  title: 'Weight',
  render() {
    const list = entries();
    const set = weightSettings();
    const now = today();
    const st = stats(list);
    const back = `<a class="back" href="#/">${icon('left')} Dashboard</a>`;
    if (!st) {
      return `${back}
        <section class="card wt-hero">
          <h3 class="card-title">⚖️ Your weight journal</h3>
          <p class="muted small">Log your weight each day. You’ll see a gentle trend line, your 7-day average, and progress toward a goal if you set one.</p>
          <button class="btn primary block" data-log>${icon('plus')} Log today’s weight</button>
          <button class="btn ghost block" data-settings>🎯 Goal & settings</button>
        </section>`;
    }
    const g = goalProgress(set, st.latest.kg, now);
    const dir = g?.direction;
    const history = [...list].reverse();
    const shown = showAll ? history : history.slice(0, 20);
    const statTile = (label, diff) => `<div class="stat"><span class="stat-label">${label}</span><span class="stat-val small-val ${tone(diff, set, dir)}">${fmtChange(diff)}</span></div>`;

    return `${back}
      <section class="card wt-hero">
        <div class="row between">
          <span class="muted small">${st.latest.date === now ? 'Today' : `Last weigh-in · ${relDays(st.latest.date).toLowerCase()}`}</span>
          <button class="icon-btn sm" data-settings aria-label="Goal & settings">${icon('gear')}</button>
        </div>
        <div class="wt-big">${st.latest.kg.toFixed(1)}<small> kg</small></div>
        ${st.change != null ? `<p class="small ${tone(st.change, set, dir)}">${fmtChange(st.change)} since ${fmtDate(previousEntry(list, st.latest.date).date)}</p>` : ''}
        ${set.gentle && st.change > 0 ? `<p class="wt-gentle">${GENTLE_UP}</p>` : ''}
        ${st.latest.date !== now ? `<button class="btn primary block" data-log>${icon('plus')} Log today’s weight</button>` : ''}
        ${goalBlock(g, set, now)}
        ${bmiBlock(st.latest.kg, set)}
      </section>

      <section class="card">
        <div class="row between"><h3 class="card-title">Trend</h3></div>
        <div class="chips wt-ranges" role="group" aria-label="Chart period">
          ${RANGES.map(([k, l]) => `<button class="chip ${range === k ? 'on' : ''}" data-range="${k}" aria-pressed="${range === k}">${l}</button>`).join('')}
        </div>
        ${chart(list, set)}
      </section>

      <section class="stats three">
        ${statTile('This week', st.week)}
        ${statTile('This month', st.month)}
        ${statTile('Since start', st.sinceStart)}
      </section>
      <section class="stats two">
        <div class="stat"><span class="stat-label">Lowest</span><span class="stat-val small-val">${kg(st.low.kg)}</span><span class="hint">${fmtDate(st.low.date)}</span></div>
        <div class="stat"><span class="stat-label">Highest</span><span class="stat-val small-val">${kg(st.high.kg)}</span><span class="hint">${fmtDate(st.high.date)}</span></div>
      </section>

      <section class="card">
        <div class="row between"><h3 class="card-title">History</h3><span class="muted small">${st.count} weigh-in${st.count === 1 ? '' : 's'}</span></div>
        <div class="list">${shown.map((e, i) => {
          const prev = history[i + 1];
          const diff = prev ? round1(e.kg - prev.kg) : null;
          return `<button class="list-item" data-edit="${e.date}">
            <span class="emoji-badge wt-day"><b>${parseISO(e.date).getDate()}</b><small>${parseISO(e.date).toLocaleString('en-GB', { month: 'short' })}</small></span>
            <span class="grow"><span class="li-title">${e.date === now ? 'Today' : fmtDateLong(e.date).replace(/ \d{4}$/, '')}</span>
              <span class="li-sub">${e.note ? esc(e.note) : relDays(e.date)}</span></span>
            <span class="wt-row-end"><span class="amount">${kg(e.kg)}</span>${diff != null ? `<span class="small ${tone(diff, set, dir)}">${fmtChange(diff)}</span>` : ''}</span>
          </button>`;
        }).join('')}</div>
        ${history.length > shown.length ? `<button class="btn ghost block" data-more>Show all ${history.length}</button>` : ''}
      </section>`;
  },
  mount(root, rerender) {
    root.querySelectorAll('[data-log]').forEach((b) => b.addEventListener('click', () => openWeightForm()));
    root.querySelectorAll('[data-settings]').forEach((b) => b.addEventListener('click', openWeightSettings));
    root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openWeightForm(b.dataset.edit)));
    root.querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => { range = b.dataset.range; rerender(); }));
    root.querySelector('[data-more]')?.addEventListener('click', () => { showAll = true; rerender(); });
    bindChart(root);
  },
  fab: () => openWeightForm(),
};
