// Small synthesized chimes — no audio files needed. Browsers only allow sound
// after the user has interacted with the page once, so call unlockAudio() on a tap.
let ctx;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}
export function unlockAudio() {
  const c = audio();
  if (c && c.state === 'suspended') c.resume();
}
function tone(c, freq, start, dur, gain = 0.18, type = 'sine') {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}
/** New order arrived: bright two-note ding, played twice. */
export function chimeNewOrder() {
  const c = audio();
  if (!c || c.state !== 'running') return;
  [0, 0.55].forEach((t) => {
    tone(c, 880, t, 0.35, 0.2);
    tone(c, 1318.5, t + 0.14, 0.5, 0.18);
  });
}
/** Order ready: rising three-note arpeggio. */
export function chimeReady() {
  const c = audio();
  if (!c || c.state !== 'running') return;
  tone(c, 659.3, 0, 0.4, 0.2, 'triangle');
  tone(c, 830.6, 0.15, 0.4, 0.2, 'triangle');
  tone(c, 987.8, 0.3, 0.7, 0.22, 'triangle');
}
