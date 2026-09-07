/* Vue « Tutoriel » — INTERCEPTOR (by D4RK)
 *
 * Douze lecons guidees. Chaque lecon propose des boutons qui font reellement
 * l action decrite, et des verifications qui lisent l etat reel de la capture :
 * une case ne se coche que si la chose a vraiment ete faite.
 * La progression est conservee dans les reglages (`tutorialDone`).
 */
import { $, el, clear, sec, button } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { state, toast, saveConfig } from '../app.js';
import { lang } from '../lib/i18n.js';
import { LESSONS as LESSONS_EN } from './content-en.js';
import { LESSONS } from './content-fr.js';

let current = 0;

const go = (view, query) =>
  document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view, query } }));

/* ------------------------------- Les lecons ------------------------------- */
/* -------------------------------- Rendu ---------------------------------- */
function done() { return new Set((state.config && state.config.tutorialDone) || []); }

async function markDone(id, value) {
  const set = done();
  if (value) set.add(id); else set.delete(id);
  await saveConfig({ tutorialDone: [...set] });
  render();
}

export function render() {
  const pane = clear($('#view-tutorial'));
  const box = el('div', { class: 'pane narrow' });
  pane.appendChild(box);

  const finished = done();
  const lesson = localized(LESSONS[Math.min(current, LESSONS.length - 1)]);
  const percent = Math.round((finished.size / LESSONS.length) * 100);

  box.appendChild(sec('Tutoriel', finished.size + ' / ' + LESSONS.length + ' lecons terminees'));
  box.appendChild(el('div', { class: 'progress' }, el('i', { style: 'width:' + percent + '%' })));

  const steps = el('div', { class: 'tuto-steps' });
  LESSONS.forEach((l, i) => {
    const dot = el('div', {
      class: 'tuto-dot' + (finished.has(l.id) ? ' done' : '') + (i === current ? ' on' : ''),
      title: localized(l).goal
    }, [
      el('span', { text: finished.has(l.id) ? '✔' : String(i + 1) }),
      el('span', { text: localized(l).title })
    ]);
    dot.addEventListener('click', () => { current = i; render(); });
    steps.appendChild(dot);
  });
  box.appendChild(steps);

  /* --- La lecon --- */
  const card = el('div', { class: 'lesson' });
  card.appendChild(el('div', { class: 'goal', text: (lang() === 'en' ? 'Lesson ' : 'Lecon ') + (current + 1) + ' · ' + lesson.goal }));
  card.appendChild(el('h3', { text: lesson.title }));

  for (const block of lesson.body) {
    if (block.p) card.appendChild(richText('p', block.p));
    if (block.ul) {
      const ul = el('ul');
      for (const item of block.ul) ul.appendChild(richText('li', item));
      card.appendChild(ul);
    }
    if (block.code) card.appendChild(el('pre', { class: 'pre nowrap', text: block.code }));
  }

  if (lesson.actions && lesson.actions.length) {
    const actions = el('div', { class: 'actions' });
    for (const [label, fn] of lesson.actions) actions.appendChild(button(label, fn));
    card.appendChild(actions);
  }

  if (lesson.checks && lesson.checks.length) {
    card.appendChild(sec('Verification', lang() === 'en' ? 'read from the real capture' : 'lue dans la capture reelle'));
    for (const [label, test] of lesson.checks) {
      let ok = false;
      try { ok = !!test(); } catch { ok = false; }
      card.appendChild(el('div', { class: 'check' + (ok ? ' ok' : '') }, [
        el('span', { class: 'mark', text: ok ? '✔' : '○' }),
        el('span', { text: t(label) })
      ]));
    }
  }

  const nav = el('div', { class: 'tuto-nav' });
  nav.appendChild(button('◀ Precedente', () => { current = Math.max(0, current - 1); render(); },
    { class: current === 0 ? 'ghost' : '' }));
  nav.appendChild(button(finished.has(lesson.id) ? 'Marquer a refaire' : 'Lecon terminee ✔',
    () => markDone(lesson.id, !finished.has(lesson.id)),
    { class: finished.has(lesson.id) ? '' : 'accent' }));
  nav.appendChild(el('span', { class: 'grow' }));
  nav.appendChild(button('Suivante ▶', () => {
    if (current < LESSONS.length - 1) { current++; render(); }
    else toast('Tutoriel termine — bonne chasse.');
  }));
  card.appendChild(nav);
  box.appendChild(card);

  const bottom = el('div', { class: 'actions' });
  bottom.appendChild(button('Tout marquer comme lu', async () => {
    await saveConfig({ tutorialDone: LESSONS.map(l => l.id) });
    toast('Tutoriel marque comme termine');
    render();
  }));
  bottom.appendChild(button('Recommencer a zero', async () => {
    current = 0;
    await saveConfig({ tutorialDone: [] });
    toast('Progression remise a zero');
    render();
  }));
  bottom.appendChild(button('Aide de reference', () => go('help')));
  box.appendChild(bottom);

  box.appendChild(el('p', { class: 'note', text:
    'Ce tutoriel se relance a tout moment depuis la barre laterale ou les reglages. ' +
    'Les verifications lisent l etat reel de la capture : rien n est coche a votre place.' }));
}

/** Rend une lecon dans la langue courante : titre, objectif et corps. */
function localized(lesson) {
  if (lang() !== 'en') return lesson;
  const en = LESSONS_EN[lesson.id];
  return en ? { ...lesson, title: en.title, goal: en.goal, body: en.body } : lesson;
}

/** Petit balisage : **gras** uniquement, sans jamais passer par innerHTML. */
function richText(tag, source) {
  const node = el(tag);
  const parts = String(source).split(/\*\*/);
  parts.forEach((part, i) => {
    if (!part) return;
    node.appendChild(i % 2 ? el('b', { text: part }) : document.createTextNode(part));
  });
  return node;
}

/** Nombre de lecons, utile aux badges de la barre laterale. */
export function total() { return LESSONS.length; }
export function remaining() { return LESSONS.length - done().size; }
