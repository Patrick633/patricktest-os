/* Life OS — feedback effects: chime, ambient brown noise, confetti. */
window.LOS = window.LOS || {};
(() => {
  "use strict";
  let ctx = null;
  const ac = () => {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };

  /** Short two-note chime. big = three notes for surprise rewards. */
  const chime = (big = false) => {
    const a = ac();
    if (!a) return;
    const notes = big ? [659.25, 830.61, 987.77] : [659.25, 987.77];
    notes.forEach((f, i) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = a.currentTime + i * 0.09;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(a.destination);
      o.start(t);
      o.stop(t + 0.55);
    });
  };

  /** Soft low tone for timer end. */
  const bell = () => {
    const a = ac();
    if (!a) return;
    [523.25, 392].forEach((f, i) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      const t = a.currentTime + i * 0.35;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(g).connect(a.destination);
      o.start(t);
      o.stop(t + 1.3);
    });
  };

  // Brown noise for focus sessions (generated, no audio files).
  let noise = null;
  const noiseOn = () => {
    const a = ac();
    if (!a || noise) return;
    const len = a.sampleRate * 4, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
    const src = a.createBufferSource(), g = a.createGain();
    src.buffer = buf;
    src.loop = true;
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.35, a.currentTime + 1.5);
    src.connect(g).connect(a.destination);
    src.start();
    noise = { src, g };
  };
  const noiseOff = () => {
    if (!noise || !ctx) return;
    const n = noise;
    noise = null;
    n.g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
    setTimeout(() => n.src.stop(), 700);
  };
  const noisePlaying = () => !!noise;

  /** Lightweight canvas confetti. */
  const confetti = (amount = 60) => {
    const cv = document.createElement("canvas");
    cv.className = "confetti";
    document.body.appendChild(cv);
    const dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
    const c = cv.getContext("2d");
    c.scale(dpr, dpr);
    const colors = ["#c8ff4d", "#8b7cff", "#ff5c8a", "#4dd8ff", "#ffd84d"];
    const ps = [...Array(amount)].map(() => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120,
      y: innerHeight * 0.45,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 13 - 4,
      r: Math.random() * 6 + 4,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.4,
      col: colors[(Math.random() * colors.length) | 0],
    }));
    let f = 0;
    const step = () => {
      c.clearRect(0, 0, innerWidth, innerHeight);
      ps.forEach((p) => {
        p.vy += 0.42; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        c.fillStyle = p.col; c.globalAlpha = Math.max(0, 1 - f / 90);
        c.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        c.restore();
      });
      if (++f < 95) requestAnimationFrame(step); else cv.remove();
    };
    requestAnimationFrame(step);
  };

  Object.assign(window.LOS, { fx: { chime, bell, noiseOn, noiseOff, noisePlaying, confetti } });
})();
