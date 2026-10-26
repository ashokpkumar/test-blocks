// A small confetti burst for when every test passes.

const COLORS = ['#FFB703', '#3A86FF', '#FF4FA3', '#00BFA6', '#3DBE52', '#8B5CF6', '#FF8A1F'];

export function confetti(duration = 2800) {
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  document.body.append(canvas);
  const g = canvas.getContext('2d');
  const W = (canvas.width = innerWidth);
  const H = (canvas.height = innerHeight);
  const bits = Array.from({ length: 180 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3,
    y: H * 0.35,
    vx: (Math.random() - 0.5) * 18,
    vy: -Math.random() * 16 - 6,
    size: 6 + Math.random() * 8,
    spin: Math.random() * Math.PI,
    vs: (Math.random() - 0.5) * 0.4,
    color: COLORS[(Math.random() * COLORS.length) | 0],
    round: Math.random() < 0.3,
  }));
  const started = performance.now();
  (function frame(now) {
    const t = now - started;
    g.clearRect(0, 0, W, H);
    g.globalAlpha = Math.max(0, 1 - t / duration);
    for (const b of bits) {
      b.vy += 0.45;
      b.vx *= 0.99;
      b.x += b.vx;
      b.y += b.vy;
      b.spin += b.vs;
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.spin);
      g.fillStyle = b.color;
      if (b.round) {
        g.beginPath();
        g.arc(0, 0, b.size / 2, 0, Math.PI * 2);
        g.fill();
      } else {
        g.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2);
      }
      g.restore();
    }
    if (t < duration) requestAnimationFrame(frame);
    else canvas.remove();
  })(started);
}
