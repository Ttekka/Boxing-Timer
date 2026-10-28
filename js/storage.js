// Sauvegarde locale (navigateur) du programme courant, des préférences et des programmes perso.

import { DEFAULT_PROGRAM, normalizeProgram } from './program.js';

const KEYS = {
  program: 'boxing-timer.program',
  prefs: 'boxing-timer.prefs',
  presets: 'boxing-timer.presets',
};

export const DEFAULT_PREFS = {
  volume: 0.9,
  muted: false,
  countdown: true,
  voice: false,
  vibrate: true,
};

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Navigation privée ou stockage plein : l'app fonctionne quand même, sans mémoire.
  }
}

export const loadProgram = () => normalizeProgram(read(KEYS.program) ?? DEFAULT_PROGRAM);
export const saveProgram = (program) => write(KEYS.program, program);

export const loadPrefs = () => ({ ...DEFAULT_PREFS, ...read(KEYS.prefs) });
export const savePrefs = (prefs) => write(KEYS.prefs, prefs);

export function loadUserPresets() {
  const list = read(KEYS.presets);
  return Array.isArray(list) ? list.map((p) => ({ ...normalizeProgram(p), id: String(p.id) })) : [];
}

export const saveUserPresets = (list) => write(KEYS.presets, list);
