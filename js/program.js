// Modèle d'un programme d'entraînement et construction de la séquence
// d'étapes (préparation, rounds, intervalles, repos) jouée par le chrono.

export const MAX_DURATION = 99 * 60 + 59;
export const MAX_COUNT = 99;
export const MAX_STEPS = 12;

export const DEFAULT_PROGRAM = {
  name: 'Boxe amateur',
  prep: 10,
  rounds: 3,
  work: 180,
  rest: 60,
  split: false,
  steps: [
    { label: 'Explosif', intensity: 'high', duration: 20 },
    { label: 'Technique', intensity: 'low', duration: 10 },
  ],
  stepRepeat: 6,
  sets: 1,
  setRest: 120,
  warning: 10,
};

export const PRESETS = [
  { ...DEFAULT_PROGRAM },
  { ...DEFAULT_PROGRAM, name: 'Boxe pro', rounds: 12 },
  { ...DEFAULT_PROGRAM, name: 'Shadow boxing', rounds: 5, work: 120, rest: 30 },
  { ...DEFAULT_PROGRAM, name: 'Fractionné sac', rounds: 6, rest: 60, split: true, warning: 0 },
  { ...DEFAULT_PROGRAM, name: 'Tabata', rounds: 8, work: 20, rest: 10, warning: 0 },
  { ...DEFAULT_PROGRAM, name: 'HIIT 30/30', rounds: 10, work: 30, rest: 30, warning: 0 },
  { ...DEFAULT_PROGRAM, name: 'Circuit 3 séries', rounds: 4, work: 45, rest: 15, sets: 3, setRest: 120, warning: 5 },
];

const clampInt = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const cleanText = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// Remet n'importe quel objet (stockage local, ancien format…) en programme valide.
export function normalizeProgram(raw = {}) {
  const d = DEFAULT_PROGRAM;
  const steps = Array.isArray(raw.steps) && raw.steps.length ? raw.steps : d.steps;
  return {
    name: cleanText(raw.name, 40) || d.name,
    prep: clampInt(raw.prep, 0, MAX_DURATION, d.prep),
    rounds: clampInt(raw.rounds, 1, MAX_COUNT, d.rounds),
    work: clampInt(raw.work, 1, MAX_DURATION, d.work),
    rest: clampInt(raw.rest, 0, MAX_DURATION, d.rest),
    split: Boolean(raw.split),
    steps: steps.slice(0, MAX_STEPS).map((step) => ({
      label: cleanText(step?.label, 24),
      intensity: step?.intensity === 'low' ? 'low' : 'high',
      duration: clampInt(step?.duration, 1, MAX_DURATION, 30),
    })),
    stepRepeat: clampInt(raw.stepRepeat, 1, MAX_COUNT, d.stepRepeat),
    sets: clampInt(raw.sets, 1, MAX_COUNT, d.sets),
    setRest: clampInt(raw.setRest, 0, MAX_DURATION, d.setRest),
    warning: clampInt(raw.warning, 0, MAX_DURATION, d.warning),
  };
}

// Les étapes qui composent un round : un seul bloc, ou les intervalles répétés.
export function roundSteps(program) {
  if (!program.split) return [{ type: 'work', duration: program.work, label: '' }];
  const steps = [];
  for (let i = 0; i < program.stepRepeat; i++) {
    for (const step of program.steps) {
      const low = step.intensity === 'low';
      steps.push({
        type: low ? 'easy' : 'work',
        duration: step.duration,
        label: step.label || (low ? 'Léger' : 'Intense'),
      });
    }
  }
  return steps;
}

export const roundDuration = (program) => roundSteps(program).reduce((sum, s) => sum + s.duration, 0);

export function buildSegments(program) {
  const steps = roundSteps(program);
  const roundLength = steps.reduce((sum, s) => sum + s.duration, 0);
  const segments = [];

  if (program.prep > 0) {
    segments.push({ type: 'prep', duration: program.prep, set: 1, round: 1 });
  }

  for (let set = 1; set <= program.sets; set++) {
    for (let round = 1; round <= program.rounds; round++) {
      let left = roundLength;
      steps.forEach((step, i) => {
        left -= step.duration;
        segments.push({
          ...step,
          set,
          round,
          step: i + 1,
          stepCount: steps.length,
          roundLength,
          roundLeftAfter: left, // secondes restantes dans le round après cette étape
        });
      });

      if (round < program.rounds) {
        if (program.rest > 0) segments.push({ type: 'rest', duration: program.rest, set, round });
      } else if (set < program.sets) {
        if (program.setRest > 0) segments.push({ type: 'setrest', duration: program.setRest, set, round });
        else if (program.rest > 0) segments.push({ type: 'rest', duration: program.rest, set, round });
      }
    }
  }

  return segments;
}

export const totalDuration = (segments) => segments.reduce((sum, s) => sum + s.duration, 0);

export function formatTime(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

// Accepte « 3:00 », « 1:30:00 » ou des chiffres façon micro-ondes : « 300 » = 3:00, « 45 » = 0:45.
export function parseDuration(text) {
  const t = String(text).trim();
  if (!t) return null;
  if (t.includes(':')) {
    const parts = t.split(':').map((p) => p.trim());
    if (parts.length > 3 || parts.some((p) => !/^\d*$/.test(p))) return null;
    return parts.reduce((acc, p) => acc * 60 + Number(p || 0), 0);
  }
  if (!/^\d+$/.test(t)) return null;
  if (t.length <= 2) return Number(t);
  return Number(t.slice(0, -2)) * 60 + Number(t.slice(-2));
}

export function describeProgram(program) {
  const round = program.split ? `${formatTime(roundDuration(program))} fractionné` : formatTime(program.work);
  let text = `${program.rounds} × ${round}`;
  if (program.rest > 0) text += ` · repos ${formatTime(program.rest)}`;
  if (program.sets > 1) text += ` · ${program.sets} séries`;
  return text;
}
