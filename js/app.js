// Écran principal : affichage du chrono, commandes et signaux sonores.

import { Timer } from './timer.js';
import { buildSegments, describeProgram, formatTime } from './program.js';
import * as sound from './audio.js';
import { loadPrefs, loadProgram, savePrefs, saveProgram } from './storage.js';
import { initSettings } from './settings.js';
import { initPresets } from './presets.js';

const $ = (id) => document.getElementById(id);
const el = {
  timer: $('timer'),
  phase: $('phase'),
  detail: $('detail'),
  clock: $('clock'),
  progress: $('progress'),
  next: $('next'),
  dots: $('dots'),
  elapsed: $('elapsed'),
  remaining: $('remaining'),
  play: $('btn-play'),
  sound: $('btn-sound'),
  programName: $('program-name'),
  toast: $('toast'),
  themeColor: document.querySelector('meta[name="theme-color"]'),
};

let program = loadProgram();
let prefs = loadPrefs();
const timer = new Timer();
sound.configure(prefs);

const isRound = (s) => s.type === 'work' || s.type === 'easy';
const isLastRound = (s) => s.set === program.sets && s.round === program.rounds;

function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

function vibrate(pattern) {
  if (prefs.vibrate && navigator.vibrate) navigator.vibrate(pattern);
}

function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  clearTimeout(toast.hide);
  toast.hide = setTimeout(() => el.toast.classList.remove('show'), 2400);
}

/* ---------- Textes ---------- */

function segmentName(s) {
  if (s.type === 'prep') return 'Préparation';
  if (s.type === 'rest') return 'Repos';
  if (s.type === 'setrest') return 'Repos long';
  if (s.step > 1) return s.label;
  return s.stepCount > 1 ? `Round ${s.round} — ${s.label}` : `Round ${s.round}`;
}

function phaseText({ status, segment: s }) {
  if (status === 'idle') return 'Prêt ?';
  if (status === 'done') return 'Terminé !';
  if (isRound(s)) return `Round ${s.round} / ${program.rounds}`;
  return segmentName(s);
}

function detailText({ status, segment: s }) {
  if (status === 'idle') return describeProgram(program);
  if (status === 'done') return `Séance de ${formatTime(timer.total)} bouclée. Bravo !`;
  if (s.type === 'setrest') return `Série ${s.set} / ${program.sets} terminée`;
  const parts = [];
  if (program.sets > 1) parts.push(`Série ${s.set} / ${program.sets}`);
  if (isRound(s) && s.stepCount > 1) parts.push(`${s.label} · ${s.step}/${s.stepCount}`);
  if (isRound(s) && isLastRound(s) && program.rounds * program.sets > 1) parts.push('Dernier round');
  return parts.join(' · ');
}

function nextText({ status, next }) {
  if (status === 'idle') return 'Touchez l’écran ou ▶ pour démarrer';
  if (status === 'done') return 'Touchez ▶ pour recommencer';
  if (status === 'paused') return 'En pause · touchez l’écran pour reprendre';
  if (!next) return 'Dernière ligne droite !';
  return `Ensuite : ${segmentName(next)} · ${formatTime(next.duration)}`;
}

/* ---------- Rendu ---------- */

function renderDots({ status, segment: s }) {
  el.dots.hidden = program.rounds > 30;
  if (el.dots.hidden) return;
  if (el.dots.childElementCount !== program.rounds) {
    el.dots.replaceChildren(...Array.from({ length: program.rounds }, () => document.createElement('i')));
  }
  const pastCurrent = !isRound(s) && s.type !== 'prep';
  [...el.dots.children].forEach((dot, i) => {
    const round = i + 1;
    const done = status === 'done' || round < s.round || (round === s.round && pastCurrent);
    const current = !done && status !== 'idle' && round === s.round && isRound(s);
    dot.className = done ? 'done' : current ? 'current' : '';
  });
}

function render() {
  const snap = timer.snapshot();
  const { status, segment: s } = snap;
  const secondsLeft = Math.ceil(snap.leftMs / 1000);

  const phase = status === 'idle' || status === 'done' ? status : s.type;
  if (el.timer.dataset.phase !== phase) {
    el.timer.dataset.phase = phase;
    el.themeColor.content = getComputedStyle(el.timer).getPropertyValue('--bg').trim();
  }
  el.timer.dataset.status = status;

  const alert = status === 'running' && (isRound(s)
    ? program.warning > 0 && s.roundLength > program.warning && secondsLeft + s.roundLeftAfter <= program.warning
    : secondsLeft <= 3);
  el.timer.classList.toggle('alert', alert);

  setText(el.phase, phaseText(snap));
  setText(el.detail, detailText(snap));
  const clock = formatTime(secondsLeft);
  setText(el.clock, clock);
  el.clock.classList.toggle('short', clock.length < 5);
  el.clock.classList.toggle('long', clock.length > 5);
  el.progress.style.transform = `scaleX(${status === 'idle' ? 0 : snap.progress})`;
  setText(el.next, nextText(snap));
  setText(el.elapsed, formatTime(Math.floor(snap.totalElapsedMs / 1000)));
  setText(el.remaining, formatTime(Math.ceil(snap.totalLeftMs / 1000)));
  renderDots(snap);

  const running = status === 'running';
  const playIcon = running ? '#i-pause' : '#i-play';
  const use = el.play.querySelector('use');
  if (use.getAttribute('href') !== playIcon) use.setAttribute('href', playIcon);
  el.play.setAttribute('aria-label', running ? 'Pause' : status === 'paused' ? 'Reprendre' : 'Démarrer');
}

function renderSoundButton() {
  el.sound.querySelector('use').setAttribute('href', prefs.muted ? '#i-mute' : '#i-sound');
  el.sound.setAttribute('aria-label', prefs.muted ? 'Activer le son' : 'Couper le son');
  el.sound.classList.toggle('off', prefs.muted);
}

function loadProgramIntoTimer() {
  timer.load(buildSegments(program));
  setText(el.programName, program.name);
  render();
}

/* ---------- Signaux ---------- */

function announce(s) {
  switch (s.type) {
    case 'prep':
      sound.say('Préparez-vous');
      break;
    case 'rest':
      sound.roundEnd();
      sound.say('Repos', 1100);
      vibrate([200, 100, 200]);
      break;
    case 'setrest':
      sound.roundEnd();
      sound.say(`Fin de la série ${s.set}. Repos`, 1100);
      vibrate([200, 100, 200]);
      break;
    default:
      if (s.step === 1) {
        sound.roundStart();
        if (isLastRound(s) && program.rounds * program.sets > 1) sound.say('Dernier round', 700);
        else if (s.round === 1 && program.sets > 1) sound.say(`Série ${s.set}, round 1`, 700);
        else sound.say(`Round ${s.round}`, 700);
        vibrate(400);
      } else {
        sound.intervalChange(s.type === 'work');
        sound.say(s.label, 350);
        vibrate(150);
      }
  }
}

function cue(s, secondsLeft) {
  if (isRound(s) && program.warning > 0 && s.roundLength > program.warning
      && secondsLeft + s.roundLeftAfter === program.warning) {
    sound.warning();
    vibrate([80, 60, 80, 60, 80]);
    return;
  }
  // Bips avant chaque reprise, et avant chaque changement d'intervalle dans un round.
  const endsWithBell = isRound(s) && s.step === s.stepCount;
  if (prefs.countdown && !endsWithBell && secondsLeft >= 1 && secondsLeft <= 3 && secondsLeft < s.duration) {
    sound.countdown();
  }
}

timer.on('segment', ({ segment }) => {
  if (timer.status === 'running') announce(segment);
  render();
});
timer.on('second', ({ segment, secondsLeft }) => cue(segment, secondsLeft));
timer.on('finish', ({ wasRunning }) => {
  if (wasRunning) {
    sound.finish();
    sound.say('Séance terminée. Bravo !', 1800);
    vibrate([400, 150, 400, 150, 600]);
  }
  render();
});
timer.on('status', (status) => {
  setAwake(status === 'running' || status === 'paused');
  render();
});
timer.on('tick', render);

/* ---------- Écran toujours allumé pendant la séance ---------- */

const wake = { lock: null, wanted: false };

function setAwake(on) {
  wake.wanted = on;
  syncWakeLock();
}

async function syncWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    if (wake.wanted && !wake.lock && document.visibilityState === 'visible') {
      const lock = await navigator.wakeLock.request('screen');
      if (!wake.wanted || wake.lock) {
        lock.release();
        return;
      }
      wake.lock = lock;
      lock.addEventListener('release', () => { if (wake.lock === lock) wake.lock = null; });
    } else if (!wake.wanted && wake.lock) {
      const lock = wake.lock;
      wake.lock = null;
      await lock.release();
    }
  } catch {
    // Refusé par le navigateur (économie d'énergie…) : le chrono continue quand même.
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    syncWakeLock();
    render();
  }
});

/* ---------- Commandes ---------- */

function togglePlay() {
  sound.unlock();
  timer.toggle();
}

function skip(direction) {
  sound.unlock();
  timer.skip(direction);
}

function reset() {
  if (timer.status === 'running' && !confirm('Arrêter la séance et revenir au début ?')) return;
  timer.reset();
}

function toggleMute() {
  prefs.muted = !prefs.muted;
  sound.unlock();
  sound.configure(prefs);
  savePrefs(prefs);
  renderSoundButton();
  toast(prefs.muted ? 'Son coupé' : 'Son activé');
}

const sameSequence = (a, b) => JSON.stringify(buildSegments(a)) === JSON.stringify(buildSegments(b));

const openSettings = initSettings({
  onApply(nextProgram, nextPrefs) {
    prefs = nextPrefs;
    savePrefs(prefs);
    sound.configure(prefs);
    renderSoundButton();
    const changed = !sameSequence(program, nextProgram);
    program = nextProgram;
    saveProgram(program);
    if (changed) loadProgramIntoTimer();
    else {
      setText(el.programName, program.name);
      render();
    }
  },
  onSavePreset: (p) => presets.save(p),
});

const presets = initPresets({
  onPick(picked) {
    program = picked;
    saveProgram(program);
    loadProgramIntoTimer();
    toast(`Programme « ${program.name} » chargé`);
  },
  toast,
});

function showSettings() {
  timer.pause();
  openSettings(program, prefs);
}

$('display').addEventListener('click', togglePlay);
el.play.addEventListener('click', togglePlay);
$('btn-prev').addEventListener('click', () => skip(-1));
$('btn-next').addEventListener('click', () => skip(1));
$('btn-reset').addEventListener('click', reset);
el.sound.addEventListener('click', toggleMute);
$('btn-settings').addEventListener('click', showSettings);
el.programName.addEventListener('click', showSettings);
$('btn-presets').addEventListener('click', () => {
  timer.pause();
  presets.open();
});

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
  if (e.target.closest('input, textarea, select')) return;
  // Espace sur un bouton déjà sélectionné : laisser le bouton faire son travail.
  if (e.key === ' ' && e.target.closest('button')) return;
  const actions = {
    ' ': togglePlay,
    ArrowRight: () => skip(1),
    ArrowLeft: () => skip(-1),
    r: reset,
    m: toggleMute,
  };
  const action = actions[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (action) {
    e.preventDefault();
    action();
  }
});

renderSoundButton();
loadProgramIntoTimer();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
