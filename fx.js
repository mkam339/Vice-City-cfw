/* Vice City — مؤثرات تفاعلية مع الماوس (جسيمات، مؤشر، إمالة ثلاثية الأبعاد، سبوت لايت، أزرار مغناطيسية) */
(function () {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const mouse = { x: -9999, y: -9999, on: false };

  /* ---------- خلفية الجسيمات ---------- */
  function particles() {
    const c = document.getElementById('bg'); if (!c || reduce) return;
    const ctx = c.getContext('2d'); let W, H, P = [], dpr = Math.min(devicePixelRatio || 1, 2);
    const cols = ['168,85,247', '217,70,239', '124,58,237', '192,132,252'];
    function size() {
      W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(110, Math.floor(W * H / 14000));
      P = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: Math.random() * 1.8 + .6, c: cols[Math.random() * cols.length | 0] }));
    }
    size(); addEventListener('resize', size);
    let run = true; document.addEventListener('visibilitychange', () => { run = !document.hidden; if (run) loop(); });
    function loop() {
      if (!run) return;
      ctx.clearRect(0, 0, W, H);
      for (const p of P) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
        if (mouse.on && d < 170) { const f = (1 - d / 170) * 1.6; p.vx += dx / d * f * .05; p.vy += dy / d * f * .05; }
        p.vx *= .985; p.vy *= .985;
        p.vx += (Math.random() - .5) * .01; p.vy += (Math.random() - .5) * .01;
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fillStyle = `rgba(${p.c},.85)`; ctx.shadowColor = `rgba(${p.c},1)`; ctx.shadowBlur = 10; ctx.fill();
      }
      ctx.shadowBlur = 0;
      for (let i = 0; i < P.length; i++) {
        for (let j = i + 1; j < P.length; j++) {
          const a = P[i], b = P[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 120) { ctx.strokeStyle = `rgba(168,85,247,${(1 - d / 120) * .22})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
        if (mouse.on) {
          const a = P[i], d = Math.hypot(a.x - mouse.x, a.y - mouse.y);
          if (d < 190) { ctx.strokeStyle = `rgba(217,70,239,${(1 - d / 190) * .55})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); }
        }
      }
      requestAnimationFrame(loop);
    }
    loop();
  }

  /* ---------- المؤشر المضيء ---------- */
  let cur, dot, cx = 0, cy = 0;
  function cursor() {
    if (!fine || reduce) return;
    cur = document.createElement('div'); cur.className = 'cursor';
    dot = document.createElement('div'); dot.className = 'cursor-dot';
    document.body.append(cur, dot); document.body.classList.add('fx-on');
    (function loop() {
      cx += (mouse.x - cx) * .14; cy += (mouse.y - cy) * .14;
      cur.style.transform = `translate(${cx}px,${cy}px)`;
      dot.style.transform = `translate(${mouse.x}px,${mouse.y}px)` + (dot.classList.contains('big') ? ' scale(2.6)' : '');
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- إمالة 3D + سبوت لايت + مغناطيس (تفويض أحداث يشمل العناصر الديناميكية) ---------- */
  let tiltEl = null, magEl = null;
  function resetTilt(el) { if (!el) return; el.style.transform = ''; el.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1)'; }
  function onMove(e) {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true;
    const t = e.target.closest ? e.target : null; if (!t) return;
    if (dot) dot.classList.toggle('big', !!t.closest('a,button,[data-tilt],.chip,.tab,.uploader,.switch,label'));

    const card = t.closest('.card'); if (card) { const r = card.getBoundingClientRect(); card.style.setProperty('--mx', (e.clientX - r.left) + 'px'); card.style.setProperty('--my', (e.clientY - r.top) + 'px'); }

    const tl = reduce ? null : t.closest('[data-tilt]');
    if (tl !== tiltEl) { resetTilt(tiltEl); tiltEl = tl; }
    if (tl) {
      const r = tl.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      const max = +tl.dataset.tilt || 8;
      tl.style.transition = 'transform .08s linear';
      tl.style.transform = `perspective(900px) rotateX(${(.5 - py) * max * 2}deg) rotateY(${(px - .5) * max * 2}deg) translateY(-4px)`;
      tl.style.setProperty('--gx', px * 100 + '%'); tl.style.setProperty('--gy', py * 100 + '%');
    }

    const mg = reduce ? null : t.closest('[data-magnetic]');
    if (mg !== magEl) { if (magEl) magEl.style.transform = ''; magEl = mg; }
    if (mg) { const r = mg.getBoundingClientRect(); mg.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .22}px,${(e.clientY - r.top - r.height / 2) * .3}px)`; }
  }
  addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', () => { mouse.on = false; resetTilt(tiltEl); tiltEl = null; if (magEl) magEl.style.transform = ''; magEl = null; });

  /* ---------- موجة عند الضغط على الأزرار ---------- */
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest('.btn'); if (!b) return;
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height), el = document.createElement('span');
    el.className = 'ripple'; el.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    b.appendChild(el); setTimeout(() => el.remove(), 650);
  });

  /* ---------- ظهور عند التمرير + عدّادات ---------- */
  let io;
  function observe(root) {
    (root || document).querySelectorAll('.reveal:not(.in)').forEach(el => {
      if (reduce || !('IntersectionObserver' in window)) return el.classList.add('in');
      io = io || new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); counters(en.target); } }), { threshold: .12 });
      io.observe(el);
    });
  }
  function counters(scope) {
    scope.querySelectorAll('[data-count]').forEach(el => {
      const to = parseFloat(el.dataset.count), suffix = el.dataset.suffix || ''; if (!isFinite(to)) return;
      const t0 = performance.now(), dur = 1400;
      (function step(t) { const k = Math.min(1, (t - t0) / dur), v = to * (1 - Math.pow(1 - k, 3)); el.textContent = Math.round(v).toLocaleString('en-US') + suffix; if (k < 1) requestAnimationFrame(step); })(t0);
    });
  }

  /* ---------- حركة الشعار مع الماوس (باراليكس) ---------- */
  function parallax() {
    const el = document.querySelector('.logo3d'); if (!el || reduce) return;
    addEventListener('pointermove', e => {
      const x = (e.clientX / innerWidth - .5), y = (e.clientY / innerHeight - .5);
      el.style.transform = `rotateY(${x * 26}deg) rotateX(${-y * 26}deg) translate(${x * 14}px,${y * 14}px)`;
    }, { passive: true });
  }

  window.FX = { observe, counters };
  document.addEventListener('DOMContentLoaded', () => { particles(); cursor(); parallax(); observe(); });
})();
