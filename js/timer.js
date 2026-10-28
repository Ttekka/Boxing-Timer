// Moteur du chrono. Le temps est toujours recalculé à partir de l'horloge
// (performance.now) : un tick en retard ne fait jamais dériver le décompte,
// il rattrape simplement les étapes déjà écoulées.

const TICK_MS = 100;

// Les timers d'un Worker ne sont pas ralentis quand l'onglet passe en arrière-plan.
function createTicker(callback) {
  try {
    const source = 'let id; onmessage = (e) => { clearInterval(id); if (e.data) id = setInterval(() => postMessage(0), e.data); };';
    const worker = new Worker(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })));
    worker.onmessage = callback;
    return { start: () => worker.postMessage(TICK_MS), stop: () => worker.postMessage(0) };
  } catch {
    let id;
    return {
      start() { clearInterval(id); id = setInterval(callback, TICK_MS); },
      stop() { clearInterval(id); },
    };
  }
}

export class Timer {
  #listeners = {};
  #ticker = createTicker(() => this.tick());

  segments = [];
  starts = []; // début de chaque étape, en secondes depuis le départ
  total = 0;
  index = 0;
  status = 'idle'; // idle | running | paused | done
  #segStart = 0; // instant (performance.now) où l'étape courante a commencé
  #offset = 0; // ms déjà écoulées dans l'étape courante, hors marche
  #lastSecond = null;

  on(event, fn) {
    (this.#listeners[event] ??= []).push(fn);
  }

  #emit(event, data) {
    for (const fn of this.#listeners[event] ?? []) fn(data);
  }

  load(segments) {
    this.segments = segments;
    this.starts = [];
    let t = 0;
    for (const s of segments) {
      this.starts.push(t);
      t += s.duration;
    }
    this.total = t;
    this.reset();
  }

  get current() {
    return this.segments[this.index];
  }

  #elapsed(now) {
    return this.status === 'running' ? now - this.#segStart : this.#offset;
  }

  #setStatus(status) {
    this.status = status;
    this.#emit('status', status);
  }

  start() {
    if (!this.segments.length || this.status === 'running') return;
    if (this.status === 'done') this.reset();
    const atSegmentStart = this.#offset === 0;
    this.#segStart = performance.now() - this.#offset;
    this.#setStatus('running');
    if (atSegmentStart) this.#emit('segment', { segment: this.current, cause: 'start' });
    this.#ticker.start();
    this.tick();
  }

  pause() {
    if (this.status !== 'running') return;
    this.#offset = performance.now() - this.#segStart;
    this.#ticker.stop();
    this.#setStatus('paused');
  }

  toggle() {
    if (this.status === 'running') this.pause();
    else this.start();
  }

  reset() {
    this.#ticker.stop();
    this.index = 0;
    this.#offset = 0;
    this.#lastSecond = null;
    this.#setStatus('idle');
  }

  // Avance (+1) ou recule (-1) d'une étape. Reculer après 2 s relance l'étape en cours.
  skip(direction) {
    if (!this.segments.length) return;
    const now = performance.now();
    let target = this.index + direction;
    if (this.status === 'done') {
      if (direction > 0) return;
      target = this.index;
    } else if (direction < 0 && this.#elapsed(now) > 2000) {
      target = this.index;
    }
    if (target >= this.segments.length) {
      this.#finish();
      return;
    }
    this.index = Math.max(0, target);
    this.#segStart = now;
    this.#offset = 0;
    this.#lastSecond = null;
    if (this.status !== 'running') this.#setStatus('paused');
    this.#emit('segment', { segment: this.current, cause: 'skip' });
    this.tick(now);
  }

  tick(now = performance.now()) {
    if (this.status === 'running') {
      let segment = this.current;
      let advanced = false;
      while (now - this.#segStart >= segment.duration * 1000) {
        if (this.index + 1 >= this.segments.length) {
          this.#finish();
          return;
        }
        this.#segStart += segment.duration * 1000;
        this.index++;
        segment = this.current;
        advanced = true;
      }
      if (advanced) {
        this.#lastSecond = null;
        this.#emit('segment', { segment, cause: 'auto' });
      }
      const secondsLeft = Math.ceil((segment.duration * 1000 - (now - this.#segStart)) / 1000);
      if (secondsLeft !== this.#lastSecond) {
        this.#lastSecond = secondsLeft;
        this.#emit('second', { segment, secondsLeft });
      }
    }
    this.#emit('tick');
  }

  #finish() {
    const wasRunning = this.status === 'running';
    this.#ticker.stop();
    this.index = this.segments.length - 1;
    this.#offset = this.current.duration * 1000;
    this.#setStatus('done');
    this.#emit('finish', { wasRunning });
  }

  snapshot(now = performance.now()) {
    const segment = this.current;
    const durationMs = segment.duration * 1000;
    const elapsedMs = Math.min(Math.max(this.#elapsed(now), 0), durationMs);
    const totalElapsedMs = this.starts[this.index] * 1000 + elapsedMs;
    return {
      status: this.status,
      index: this.index,
      segment,
      next: this.segments[this.index + 1] ?? null,
      leftMs: durationMs - elapsedMs,
      progress: elapsedMs / durationMs,
      totalElapsedMs,
      totalLeftMs: this.total * 1000 - totalElapsedMs,
    };
  }
}
