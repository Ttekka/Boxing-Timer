// Sons synthétisés avec la Web Audio API (aucun fichier à charger) :
// cloche de ring, claquement d'alerte, bips de décompte, annonces vocales.

let ctx = null;
let master = null;
let noise = null;
let volume = 0.9;
let muted = false;
let voiceEnabled = false;
let frenchVoice = null;

function audio() {
  if (!ctx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    ctx = new AudioContextClass();
    // Le compresseur évite la saturation quand plusieurs coups de cloche se chevauchent.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.connect(ctx.destination);
    master = ctx.createGain();
    master.connect(limiter);
    applyGain();
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx;
}

function applyGain() {
  if (master) master.gain.value = muted ? 0 : volume * volume;
}

// À appeler depuis un geste utilisateur : iOS ne joue rien sinon.
export function unlock() {
  const c = audio();
  if (!c) return;
  const source = c.createBufferSource();
  source.buffer = c.createBuffer(1, 1, 22050);
  source.connect(c.destination);
  source.start(0);
}

export function configure({ volume: v, muted: m, voice }) {
  if (v !== undefined) volume = v;
  if (m !== undefined) muted = m;
  if (voice !== undefined) voiceEnabled = voice;
  applyGain();
}

function noiseBuffer() {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

function envelope(gain, t, peak, attack, release) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
}

function tone(t, freq, length, { type = 'sine', level = 0.5 } = {}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  envelope(gain, t, level, 0.006, length);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

function burst(t, { freq, q, length, level }) {
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = noiseBuffer();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  envelope(gain, t, level, 0.002, length);
  source.connect(filter).connect(gain).connect(master);
  source.start(t, Math.random() * 0.5);
  source.stop(t + length + 0.05);
}

// Partiels inharmoniques d'une cloche : [rapport de fréquence, amplitude, durée de résonance (s)].
const BELL_PARTIALS = [
  [1, 1, 2.6],
  [1.004, 0.6, 2.4],
  [2.02, 0.55, 1.7],
  [2.76, 0.5, 1.3],
  [4.07, 0.32, 0.9],
  [5.43, 0.22, 0.65],
  [6.82, 0.14, 0.45],
  [8.93, 0.08, 0.3],
];

function strike(t, freq = 760, level = 1) {
  const out = ctx.createGain();
  out.gain.value = 0.22 * level;
  out.connect(master);
  for (const [ratio, amp, decay] of BELL_PARTIALS) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq * ratio;
    envelope(gain, t, amp, 0.003, decay);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + decay + 0.1);
  }
  burst(t, { freq: 4200, q: 1.2, length: 0.05, level: 0.35 * level });
}

const ready = () => audio() && !muted;
const at = (delay = 0) => ctx.currentTime + 0.02 + delay;

export function roundStart() {
  if (!ready()) return;
  strike(at());
}

export function roundEnd() {
  if (!ready()) return;
  for (let i = 0; i < 3; i++) strike(at(i * 0.32), 760, 0.9);
}

export function finish() {
  if (!ready()) return;
  for (let i = 0; i < 3; i++) strike(at(i * 0.3), 760, 0.9);
  for (let i = 0; i < 3; i++) strike(at(1.3 + i * 0.3), 760, 0.9);
}

// Claquement des « sticks » : il reste quelques secondes dans le round.
export function warning() {
  if (!ready()) return;
  for (let i = 0; i < 3; i++) {
    const t = at(i * 0.17);
    burst(t, { freq: 2300, q: 2.5, length: 0.06, level: 2.2 });
    tone(t, 1250, 0.05, { type: 'triangle', level: 0.35 });
  }
}

export function countdown() {
  if (!ready()) return;
  tone(at(), 880, 0.14, { type: 'triangle', level: 0.6 });
}

// Changement d'intervalle à l'intérieur d'un round : montant vers l'intense, descendant vers le léger.
export function intervalChange(intense) {
  if (!ready()) return;
  const [a, b] = intense ? [784, 1175] : [1175, 784];
  tone(at(), a, 0.12, { type: 'triangle', level: 0.6 });
  tone(at(0.13), b, 0.18, { type: 'triangle', level: 0.6 });
}

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  frenchVoice = voices.find((v) => v.lang === 'fr-FR' && v.localService) ?? voices.find((v) => v.lang?.startsWith('fr')) ?? null;
}

export const speechSupported = 'speechSynthesis' in window;

if (speechSupported) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function say(text, delay = 0) {
  if (!speechSupported || !voiceEnabled || muted) return;
  setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.05;
    utterance.volume = volume;
    if (frenchVoice) utterance.voice = frenchVoice;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }, delay);
}
