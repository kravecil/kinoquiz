/**
 * Звуки синтезируются Web Audio API — никаких файлов, бандл не растёт.
 * Звук выключается во время рекламы и когда вкладка скрыта (требование площадки).
 */

type SfxName = 'tap' | 'correct' | 'wrong' | 'coin' | 'reel';

let ctx: AudioContext | null = null;
let enabled = true;
let suspendedByPlatform = false;

function audio(): AudioContext | null {
  if (!enabled || suspendedByPlatform) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

/** Пауза от площадки: реклама или скрытая вкладка. */
export function setPlatformPaused(paused: boolean): void {
  suspendedByPlatform = paused;
  if (!ctx) return;
  if (paused) void ctx.suspend();
  else if (enabled) void ctx.resume();
}

function tone(
  ac: AudioContext,
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.15,
): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Короткий щелчок, как у кинопроектора. */
function click(ac: AudioContext, start: number, volume = 0.08): void {
  const length = Math.floor(ac.sampleRate * 0.012);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  gain.gain.value = volume;
  src.buffer = buffer;
  src.connect(gain).connect(ac.destination);
  src.start(start);
}

export function play(name: SfxName): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  switch (name) {
    case 'tap':
      click(ac, t, 0.05);
      break;
    case 'correct':
      tone(ac, 659, t, 0.18, 'triangle');
      tone(ac, 988, t + 0.09, 0.32, 'triangle');
      break;
    case 'wrong':
      tone(ac, 196, t, 0.28, 'sawtooth', 0.07);
      tone(ac, 147, t + 0.12, 0.34, 'sawtooth', 0.06);
      break;
    case 'coin':
      tone(ac, 1319, t, 0.08, 'square', 0.04);
      tone(ac, 1760, t + 0.07, 0.16, 'square', 0.04);
      break;
    case 'reel':
      for (let i = 0; i < 8; i++) click(ac, t + i * 0.045, 0.06);
      break;
  }
}
