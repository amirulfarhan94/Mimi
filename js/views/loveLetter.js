// Mimi Love Letter 💌 — dashboard card + popup with today's note from Hubby.
import { esc } from '../util.js';
import { noteFor } from '../loveLetter.js';

/** Envelope with a heart seal, a peeking letter and a few sparkles (decorative). */
const envelope = (cls = '') => `
  <svg class="envelope ${cls}" viewBox="0 0 120 96" aria-hidden="true" focusable="false">
    <path class="env-sparkle" d="M14 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>
    <path class="env-sparkle" d="M106 8l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z"/>
    <path class="env-sparkle" d="M110 52l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z"/>
    <rect class="env-back" x="18" y="32" width="84" height="56" rx="9"/>
    <rect class="env-paper" x="30" y="12" width="60" height="50" rx="5"/>
    <path class="env-lines" d="M40 25h40M40 33h34M40 41h28"/>
    <path class="env-front" d="M18 44l42 26 42-26v35a9 9 0 0 1-9 9H27a9 9 0 0 1-9-9z"/>
    <path class="env-fold" d="M21 85l30-19M99 85L69 66"/>
    <circle class="env-seal" cx="60" cy="68" r="11"/>
    <path class="env-heart" transform="translate(53 61) scale(.58)"
      d="M12 21s-7-4.35-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.65-9.5 9-9.5 9z"/>
  </svg>`;

/** Dashboard card. On special dates it hints at the birthday / anniversary letter. */
export function letterCard(date = new Date()) {
  const note = noteFor(date);
  const o = note.kind === 'special' ? note.occasion : null;
  return `
    <button class="letter-card ${o ? `special ${o.theme}` : ''}" data-love-letter aria-haspopup="dialog">
      ${envelope()}
      <span class="letter-card-title">${o ? `${o.emoji} ${esc(o.cardTitle)}` : '💌 A Little Note for You'}</span>
      <span class="letter-card-sub">${o ? esc(o.cardSubtitle) : 'Your daily love letter is waiting...'}</span>
    </button>`;
}

export function bindLetterCard(root) {
  root.querySelector('[data-love-letter]')?.addEventListener('click', () => openLetter());
}

// ---------- Popup ----------
let dialog;

function getDialog() {
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.className = 'letter-modal';
  dialog.setAttribute('aria-labelledby', 'letterTitle');
  // Tap on the dimmed backdrop closes it.
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  document.body.append(dialog);
  return dialog;
}

const paragraphs = (text) => text.split(/\n\s*\n/).map((p) => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');

/** Letter body: short daily notes get soft quotation marks, multi-paragraph special letters don't. */
function letterHTML(note) {
  const multi = /\n\s*\n/.test(note.text);
  return `
    <div class="letter-text ${multi ? 'long' : ''}">${multi ? paragraphs(note.text) : `<p>“${esc(note.text)}”</p>`}</div>
    ${note.signature ? `<p class="letter-sign">— ${esc(note.signature)}</p>` : ''}`;
}

function headHTML(note) {
  const o = note.kind === 'special' ? note.occasion : null;
  const kicker = o ? 'A special letter for today' : 'Today’s letter';
  return `
    <div class="letter-icon" aria-hidden="true">${o ? `<span class="letter-emoji">${o.emoji}</span>` : envelope('small')}</div>
    <h2 class="letter-title" id="letterTitle">${o ? esc(o.title) : 'A Little Note for You'}</h2>
    <p class="letter-kicker">${kicker}</p>`;
}

/** Floating confetti (birthdays) or hearts (anniversary) for special letters — plays once. */
function sparkles(theme) {
  if (!theme) return '';
  const glyphs = theme === 'anniversary' ? ['♥', '♡', '💕'] : ['✦', '●', '▲', '♥', '✧'];
  return `<div class="letter-float ${theme}" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => {
    const left = (i * 71) % 100;
    const delay = ((i * 37) % 12) / 10;
    const dur = 2.6 + ((i * 13) % 10) / 10;
    return `<span style="left:${left}%;animation-delay:${delay}s;animation-duration:${dur}s">${glyphs[i % glyphs.length]}</span>`;
  }).join('')}</div>`;
}

/**
 * Open the popup with today's one note (special dates override the daily letter).
 * The note depends only on the date, so it stays the same all day and changes by itself tomorrow.
 */
export function openLetter(date = new Date()) {
  const d = getDialog();
  const note = noteFor(date);
  const theme = note.kind === 'special' ? note.occasion.theme : '';

  d.innerHTML = `
    <article class="letter-paper ${theme ? `special ${theme}` : ''}">
      ${sparkles(theme)}
      <header class="letter-head">${headHTML(note)}</header>
      <div class="letter-body">${letterHTML(note)}</div>
      <footer class="letter-actions">
        <button class="btn primary block" data-close>Close</button>
      </footer>
    </article>`;

  d.querySelector('[data-close]').addEventListener('click', () => d.close());
  d.showModal();
  d.querySelector('[data-close]').focus({ preventScroll: true });
}
