// Feuille « Réglages » : édite une copie du programme et des préférences,
// appliquée à la fermeture (bouton Valider, croix, Échap ou clic à côté).

import {
  MAX_COUNT, MAX_DURATION, MAX_STEPS,
  buildSegments, formatTime, normalizeProgram, parseDuration, roundDuration, totalDuration,
} from './program.js';
import * as sound from './audio.js';

// Pas adaptatif : 5 s sous la minute, 15 s jusqu'à 5 min, 30 s au-delà.
const durationStep = (seconds) => (seconds < 60 ? 5 : seconds < 300 ? 15 : 30);

function stepDuration(value, direction) {
  if (direction > 0) {
    const step = durationStep(value);
    return Math.floor(value / step) * step + step;
  }
  const step = durationStep(value - 1);
  return Math.ceil(value / step) * step - step;
}

function createStepper({ kind, min, max, label, compact = false, onChange }) {
  const root = document.createElement('div');
  root.className = compact ? 'stepper compact' : 'stepper';
  root.innerHTML = `
    <button type="button" class="step-btn" data-dir="-1" aria-label="Diminuer">−</button>
    <input class="step-value" type="text" inputmode="numeric" autocomplete="off" spellcheck="false">
    <button type="button" class="step-btn" data-dir="1" aria-label="Augmenter">+</button>`;
  const input = root.querySelector('input');
  const [minus, plus] = root.querySelectorAll('.step-btn');
  input.setAttribute('aria-label', label);

  let value = min;
  let delay;
  let repeat;

  const format = (v) => (kind === 'duration' ? formatTime(v) : String(v));
  const stopRepeat = () => {
    clearTimeout(delay);
    clearInterval(repeat);
  };
  const show = () => {
    input.value = format(value);
    minus.classList.toggle('off', value <= min);
    plus.classList.toggle('off', value >= max);
  };
  const set = (next, notify = true) => {
    const clamped = Math.min(max, Math.max(min, Math.round(next)));
    if (clamped === value) {
      stopRepeat();
      show();
      return;
    }
    value = clamped;
    show();
    if (notify) onChange(value);
  };
  const bump = (dir) => set(kind === 'duration' ? stepDuration(value, dir) : value + dir);

  for (const button of [minus, plus]) {
    const dir = Number(button.dataset.dir);
    button.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      bump(dir);
      stopRepeat();
      delay = setTimeout(() => { repeat = setInterval(() => bump(dir), 70); }, 420);
    });
    for (const type of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(type, stopRepeat);
    // Les pointeurs sont gérés ci-dessus ; le clic ne sert qu'au clavier (detail === 0).
    button.addEventListener('click', (e) => { if (e.detail === 0) bump(dir); });
    button.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  const commit = () => {
    const parsed = kind === 'duration' ? parseDuration(input.value) : Number.parseInt(input.value, 10);
    if (parsed === null || Number.isNaN(parsed)) show();
    else set(parsed);
  };
  input.addEventListener('focus', () => input.select());
  input.addEventListener('change', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      bump(e.key === 'ArrowUp' ? 1 : -1);
    }
  });

  show();
  return { el: root, setValue: (v) => set(v, false) };
}

const FIELDS = {
  rounds: { kind: 'count', min: 1, max: MAX_COUNT, label: 'Nombre de rounds' },
  work: { kind: 'duration', min: 1, max: MAX_DURATION, label: 'Durée d’un round' },
  rest: { kind: 'duration', min: 0, max: MAX_DURATION, label: 'Repos entre les rounds' },
  stepRepeat: { kind: 'count', min: 1, max: MAX_COUNT, label: 'Répétitions de la séquence' },
  sets: { kind: 'count', min: 1, max: MAX_COUNT, label: 'Nombre de séries' },
  setRest: { kind: 'duration', min: 0, max: MAX_DURATION, label: 'Repos entre les séries' },
  prep: { kind: 'duration', min: 0, max: MAX_DURATION, label: 'Préparation' },
  warning: { kind: 'duration', min: 0, max: MAX_DURATION, label: 'Alerte avant la fin du round' },
};

const INTENSITY_LABEL = { high: 'Fort', low: 'Léger' };

export function initSettings({ onApply, onSavePreset }) {
  const dialog = document.getElementById('settings');
  const $ = (id) => document.getElementById(id);
  const nameInput = $('f-name');
  const splitInput = $('f-split');
  const stepsList = $('steps');
  const addStep = $('add-step');
  const prefInputs = { countdown: $('f-countdown'), voice: $('f-voice'), vibrate: $('f-vibrate') };
  const volumeInput = $('f-volume');

  let draft;
  let prefs;

  if (!sound.speechSupported) $('row-voice').hidden = true;
  if (!('vibrate' in navigator)) $('row-vibrate').hidden = true;

  const steppers = {};
  for (const [key, field] of Object.entries(FIELDS)) {
    const stepper = createStepper({
      ...field,
      onChange: (v) => {
        draft[key] = v;
        refresh();
      },
    });
    dialog.querySelector(`[data-stepper="${key}"]`).replaceWith(stepper.el);
    steppers[key] = stepper;
  }

  function refresh() {
    $('row-work').hidden = draft.split;
    $('split-editor').hidden = !draft.split;
    $('row-setrest').classList.toggle('muted', draft.sets < 2);
    addStep.disabled = draft.steps.length >= MAX_STEPS;
    $('round-length').textContent = `Durée d’un round : ${formatTime(roundDuration(draft))}`;
    $('f-total').textContent = formatTime(totalDuration(buildSegments(draft)));
    for (const button of stepsList.querySelectorAll('.step-delete')) button.disabled = draft.steps.length < 2;
  }

  function renderSteps() {
    stepsList.replaceChildren(...draft.steps.map((step, index) => {
      const item = document.createElement('li');
      item.className = 'step';
      item.dataset.intensity = step.intensity;

      const intensity = document.createElement('button');
      intensity.type = 'button';
      intensity.className = 'intensity';
      intensity.title = 'Changer l’intensité';
      intensity.textContent = INTENSITY_LABEL[step.intensity];
      intensity.addEventListener('click', () => {
        step.intensity = step.intensity === 'high' ? 'low' : 'high';
        item.dataset.intensity = step.intensity;
        intensity.textContent = INTENSITY_LABEL[step.intensity];
        label.placeholder = step.intensity === 'low' ? 'Léger' : 'Intense';
      });

      const label = document.createElement('input');
      label.type = 'text';
      label.className = 'step-label';
      label.maxLength = 24;
      label.value = step.label;
      label.placeholder = step.intensity === 'low' ? 'Léger' : 'Intense';
      label.setAttribute('aria-label', `Nom de l’intervalle ${index + 1}`);
      label.addEventListener('input', () => { step.label = label.value; });

      const duration = createStepper({
        kind: 'duration', min: 1, max: MAX_DURATION, compact: true,
        label: `Durée de l’intervalle ${index + 1}`,
        onChange: (v) => {
          step.duration = v;
          refresh();
        },
      });
      duration.setValue(step.duration);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'icon-btn small step-delete';
      remove.setAttribute('aria-label', `Supprimer l’intervalle ${index + 1}`);
      remove.innerHTML = '<svg><use href="#i-trash"/></svg>';
      remove.addEventListener('click', () => {
        draft.steps.splice(index, 1);
        renderSteps();
      });

      item.append(intensity, label, duration.el, remove);
      return item;
    }));
    refresh();
  }

  addStep.addEventListener('click', () => {
    const last = draft.steps.at(-1);
    draft.steps.push({ label: '', intensity: last?.intensity === 'high' ? 'low' : 'high', duration: last?.duration ?? 30 });
    renderSteps();
    stepsList.lastElementChild?.querySelector('.step-label').focus();
  });

  nameInput.addEventListener('input', () => { draft.name = nameInput.value; });
  splitInput.addEventListener('change', () => {
    draft.split = splitInput.checked;
    refresh();
  });
  for (const [key, input] of Object.entries(prefInputs)) {
    input.addEventListener('change', () => { prefs[key] = input.checked; });
  }
  volumeInput.addEventListener('input', () => {
    prefs.volume = Number(volumeInput.value);
    sound.configure({ volume: prefs.volume });
  });
  $('test-sound').addEventListener('click', () => {
    sound.unlock();
    sound.configure({ volume: prefs.volume, muted: false, voice: prefs.voice });
    sound.roundStart();
    sound.say('Round 1', 900);
  });
  $('save-preset').addEventListener('click', () => onSavePreset(normalizeProgram(draft)));

  // Entrée dans un champ texte valide la saisie sans fermer la feuille.
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });

  // Sortir du champ en cours d'édition déclenche son « change » avant d'appliquer.
  const close = () => {
    document.activeElement?.blur?.();
    dialog.close();
  };
  for (const button of dialog.querySelectorAll('[data-close]')) button.addEventListener('click', close);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  dialog.addEventListener('cancel', () => document.activeElement?.blur?.());
  dialog.addEventListener('close', () => onApply(normalizeProgram(draft), prefs));

  return function open(program, currentPrefs) {
    draft = structuredClone(program);
    prefs = { ...currentPrefs };
    nameInput.value = draft.name;
    splitInput.checked = draft.split;
    for (const [key, stepper] of Object.entries(steppers)) stepper.setValue(draft[key]);
    for (const [key, input] of Object.entries(prefInputs)) input.checked = prefs[key];
    volumeInput.value = prefs.volume;
    renderSteps();
    dialog.showModal();
    dialog.querySelector('.sheet-body').scrollTop = 0;
  };
}
