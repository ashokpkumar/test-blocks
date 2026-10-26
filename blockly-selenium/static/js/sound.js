// Tiny synthesizer: every sound is generated with Web Audio, no files needed.

let ctx = null;
let muted = false;
try { muted = localStorage.getItem('blockbots.muted') === '1'; } catch {}

function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', vol = 0.18, delay = 0, slide = null } = {}) {
  if (muted) return;
  const a = audio();
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur, { vol = 0.12, from = 3000, to = 300 } = {}) {
  if (muted) return;
  const a = audio();
  const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  const filter = a.createBiquadFilter();
  const gain = a.createGain();
  src.buffer = buf;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(from, a.currentTime);
  filter.frequency.exponentialRampToValueAtTime(to, a.currentTime + dur);
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(a.destination);
  src.start();
}

// C-major pentatonic: every step of a test climbs a friendly scale.
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

export const sound = {
  get muted() { return muted; },
  toggle() {
    muted = !muted;
    try { localStorage.setItem('blockbots.muted', muted ? '1' : '0'); } catch {}
    if (!muted) this.click();
    return muted;
  },
  click: () => tone(700, 0.06, { type: 'triangle', vol: 0.1 }),
  pick: () => tone(440, 0.09, { type: 'triangle', vol: 0.14, slide: 760 }),
  hover: () => tone(1200, 0.03, { type: 'sine', vol: 0.05 }),
  snap: () => {
    tone(900, 0.04, { type: 'square', vol: 0.06 });
    tone(1350, 0.09, { type: 'triangle', vol: 0.14, delay: 0.035 });
  },
  drop: () => tone(330, 0.12, { type: 'sine', vol: 0.15, slide: 220 }),
  trash: () => {
    noise(0.35, { vol: 0.18 });
    tone(600, 0.3, { type: 'sawtooth', vol: 0.05, slide: 90 });
  },
  start: () => [392, 523.25, 659.25].forEach((f, i) => tone(f, 0.12, { type: 'triangle', vol: 0.14, delay: i * 0.07 })),
  step: i => {
    const f = SCALE[i % SCALE.length];
    tone(f, 0.18, { type: 'sine', vol: 0.16 });
    tone(f * 2, 0.08, { type: 'triangle', vol: 0.04 });
  },
  win: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.16, delay: i * 0.1 }));
    [1046.5, 1318.51, 1567.98].forEach(f => tone(f, 0.6, { type: 'sine', vol: 0.08, delay: 0.42 }));
  },
  fail: () => {
    tone(392, 0.25, { type: 'sawtooth', vol: 0.08, slide: 370 });
    tone(370, 0.25, { type: 'sawtooth', vol: 0.08, delay: 0.27, slide: 349 });
    tone(349, 0.55, { type: 'sawtooth', vol: 0.08, delay: 0.54, slide: 260 });
  },
  oops: () => {
    tone(300, 0.1, { type: 'square', vol: 0.06 });
    tone(220, 0.16, { type: 'square', vol: 0.06, delay: 0.1 });
  },
};
