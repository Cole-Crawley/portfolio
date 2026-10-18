// Redesign v3, home page. The page is complete without this file: the shelf scrolls sideways and links jump to each project.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // Clocks.
  const tick = () => $$('[data-clock]').forEach((el) => {
    el.textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: el.dataset.clock }).format(new Date());
  });
  tick(); setInterval(tick, 20000);

  // The name always spans the full width.
  const name = $('.name'), hero = $('.hero');
  const fit = () => {
    name.style.fontSize = '200px';
    const room = hero.clientWidth - 2 * parseFloat(getComputedStyle(name).left);
    name.style.fontSize = (200 * room / name.offsetWidth).toFixed(1) + 'px';
    hero.style.setProperty('--name-h', name.offsetHeight + 'px');
  };
  fit(); addEventListener('resize', fit);
  if (document.fonts) document.fonts.ready.then(fit);

  // ---------- The shelf ----------
  const shelf = $('.lineup'), items = $$('.item', shelf), n = items.length;
  shelf.classList.add('is-live');
  // Browsers without overflow: clip can still scroll the row under a swipe; keep it at the start so the packs stay where they are drawn.
  shelf.addEventListener('scroll', () => { if (shelf.scrollLeft) shelf.scrollLeft = 0; });
  let pos = 0, target = 0, dragging = false, startX = 0, startPos = 0, moved = 0, lastX = 0, vel = 0, busy = false, pending = null;
  const t0 = performance.now();
  // Each pack starts as live SVG, then switches to its pre-drawn picture (flatten.py) once that has loaded. The two look the same;
  // the picture just costs far less to redraw while the shelf moves (Firefox re-runs the SVG paint filters on every frame).
  items.forEach((it) => {
    const svg = $('.pack-art', it), g = svg && svg.querySelector('g[clip-path]'), src = it.dataset.flat;
    if (!g || !src) return;
    const [, , w, h] = svg.getAttribute('viewBox').split(' ');
    const im = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    im.setAttribute('width', w); im.setAttribute('height', h); im.setAttribute('preserveAspectRatio', 'none');
    // drawn on top first and the SVG artwork removed only once the picture is showing, so there is never a blank frame
    im.addEventListener('load', () => requestAnimationFrame(() => { [...g.children].forEach((c) => { if (c !== im) c.remove(); }); }), { once: true });
    im.setAttribute('href', src); g.appendChild(im);
  });
  const wrap = (d) => ((d + n / 2) % n + n) % n - n / 2;
  const ease = (t) => 1 - Math.pow(1 - t, 4);
  // On a phone the packs sit further apart, so the neighbours peek in from the edges and never hide under the middle one.
  const gapPx = () => (innerWidth < 700 ? innerWidth * 0.5 : Math.min(innerWidth * 0.31, 560));

  const layout = (now) => {
    const h = innerHeight, gap = gapPx();
    items.forEach((el, i) => {
      const d = wrap(i - pos), a = Math.max(0, 1 - Math.abs(d));
      const intro = reduce ? 1 : ease(Math.min(1, Math.max(0, (now - t0 - 250 - Math.abs(wrap(i)) * 110) / 1100)));
      const x = d * gap, y = a * h * 0.085 - (1 - intro) * h * 1.1;
      const s = 0.8 + 0.66 * a * a, r = d * 5 + (1 - intro) * (i % 2 ? 24 : -24);
      el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(3)})`;
      el.style.zIndex = String(50 - Math.round(Math.abs(d) * 10));
      // with few packs the one furthest away would be half on screen as it wraps round, so it fades out before it gets there
      el.style.opacity = Math.max(0, Math.min(1, (n / 2 - Math.abs(d)) / 0.3)).toFixed(2);
      el.classList.toggle('is-near', Math.abs(d) < 0.5);
      el.firstElementChild.tabIndex = Math.abs(d) < 2.4 ? 0 : -1;
    });
  };
  const frame = (now) => {
    if (!dragging) pos += (target - pos) * (reduce ? 1 : 0.11);
    layout(now);
    // A pack that was clicked while off-centre opens once it has arrived in the middle.
    if (pending && Math.abs(wrap(+pending.dataset.i - pos)) < 0.04) { const it = pending; pending = null; openFromPack(it); }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  const step = (dir) => { pending = null; target = Math.round(target) + dir; };
  // A click on a pack at the side only brings it to the middle. Only the pack in the middle opens,
  // so browsing the shelf never leaves the page by accident. The keyboard (Enter) still goes straight there.
  const choose = (item, open) => {
    const d = wrap(+item.dataset.i - pos);
    if (Math.abs(d) < 0.3 && Math.abs(wrap(+item.dataset.i - target)) < 0.5) return openFromPack(item);
    target = Math.round(pos + d); pending = open ? item : null;
  };
  $$('[data-step]').forEach((b) => b.addEventListener('click', () => step(+b.dataset.step)));

  // Which pack is under the pointer. Only the printed shape of a pack receives the pointer (see styles.css),
  // so the empty corners of a rotated neighbour can never take the click.
  const packAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('.item') : null; };

  shelf.addEventListener('pointerdown', (e) => {
    if (busy || e.button > 0) return;
    dragging = true; moved = 0; startX = lastX = e.clientX; startPos = pos; vel = 0; pending = null;
    shelf.setPointerCapture(e.pointerId);
  });
  shelf.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    moved = Math.max(moved, Math.abs(e.clientX - startX));
    if (moved > 8) shelf.classList.add('is-drag');
    vel = e.clientX - lastX; lastX = e.clientX;
    if (moved > 8) pos = startPos - (e.clientX - startX) / gapPx();
  });
  const drop = (e) => {
    if (!dragging) return;
    dragging = false; shelf.classList.remove('is-drag');
    if (moved > 8) {
      // By touch, one swipe moves one pack in the direction of the swipe, however short or fast; a long drag can carry further.
      // With a mouse the shelf keeps a little momentum.
      if (e.pointerType === 'touch' || e.pointerType === 'pen') { const d = pos - startPos; target = Math.round(startPos) + (Math.abs(d) > 1.4 ? Math.round(d) : Math.sign(d) * (moved > 24 ? 1 : 0)); }
      else target = Math.round(pos - (vel / gapPx()) * 6);
      return;
    }
    target = Math.round(pos);
    const item = packAt(e.clientX, e.clientY);
    if (item) choose(item);
  };
  shelf.addEventListener('pointerup', drop);
  shelf.addEventListener('pointercancel', () => { dragging = false; shelf.classList.remove('is-drag'); target = Math.round(pos); });
  shelf.addEventListener('click', (e) => e.preventDefault());
  shelf.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'Enter' || e.key === ' ') { const item = e.target.closest('.item'); if (item) { e.preventDefault(); choose(item, true); } }
  });
  shelf.addEventListener('focusin', (e) => { const item = e.target.closest('.item'); if (item && !dragging) target = Math.round(pos + wrap(+item.dataset.i - pos)); });

  // ---------- Opening a pack ----------
  // The pack tears in half, then the browser moves to that project's page.
  function openFromPack(item) {
    if (busy) return;
    const link = item.firstElementChild, go = () => { location.href = link.href; };
    busy = true;
    if (reduce) return go();
    const art = $('.pack-art', item), r = art.getBoundingClientRect();
    const halves = [0, 1].map((k) => {
      const d = document.createElement('div'); d.className = 'tear';
      Object.assign(d.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', clipPath: k ? 'polygon(0 46%,12% 52%,25% 45%,38% 53%,52% 46%,66% 54%,80% 47%,100% 52%,100% 100%,0 100%)' : 'polygon(0 0,100% 0,100% 52%,80% 47%,66% 54%,52% 46%,38% 53%,25% 45%,12% 52%,0 46%)' });
      d.appendChild(art.cloneNode(true)); document.body.appendChild(d); return d;
    });
    item.style.visibility = 'hidden';
    const opt = { duration: 620, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'forwards' };
    halves[0].animate([{ transform: 'none' }, { transform: `translate(-6vw,-${innerHeight}px) rotate(-16deg) scale(2.2)` }], opt);
    halves[1].animate([{ transform: 'none' }, { transform: `translate(6vw,${innerHeight}px) rotate(12deg) scale(2.2)` }], opt).onfinish = go;
  }
  // Coming back with the browser's Back button restores the page as it was left, so put the shelf back together.
  addEventListener('pageshow', (e) => { if (e.persisted) { busy = false; $$('.tear').forEach((d) => d.remove()); items.forEach((it) => { it.style.visibility = ''; }); } });

  // ---------- The box TV ----------
  // Cycles through the photos. Each change is a burst of static with a rolling picture, then the next photo.
  const tv = $('.tv');
  if (tv) {
    const set = $('.tv-set', tv), screen = $('.tv-screen', tv), pics = $$('img', screen), cv = $('.tv-static', tv), ctx = cv.getContext('2d');
    const ch = $('.tv-ch', tv), pauseBtn = $('.tv-pause', tv), knob = $('.tv-knob', tv);
    let at = 0, held = reduce, seen = false, changing = false, timer = null, turns = 0;
    const label = (i) => (i === pics.length - 1 ? 'NOW' : 'CH ' + String(i + 1).padStart(2, '0'));
    const snow = () => {
      const img = ctx.createImageData(cv.width, cv.height), d = img.data, band = Math.random() * cv.height;
      for (let p = 0, y = 0; y < cv.height; y++) {
        const boost = Math.abs(y - band) < 9 ? 70 : 0;
        for (let x = 0; x < cv.width; x++, p += 4) { const v = Math.random() * 215 + boost; d[p] = d[p + 1] = d[p + 2] = v; d[p + 3] = 255; }
      }
      ctx.putImageData(img, 0, 0);
    };
    const swap = (to) => { pics[at].classList.remove('on'); at = to; pics[at].classList.add('on'); ch.textContent = label(at); screen.classList.remove('show-ch'); void ch.offsetWidth; screen.classList.add('show-ch'); setTimeout(() => screen.classList.remove('show-ch'), 60); };
    const change = (to) => {
      if (changing) return; turns++; set.style.setProperty('--turn', turns);
      if (reduce) return swap(to);
      changing = true; screen.classList.add('is-static');
      const start = performance.now(); let swapped = false;
      const run = (now) => {
        const t = now - start; snow();
        cv.style.opacity = t < 90 ? t / 90 * 0.9 : t > 380 ? Math.max(0, 1 - (t - 380) / 140) * 0.9 : 0.9;
        screen.style.setProperty('--roll', ((t % 120) / 120 * 8 - 4).toFixed(1) + '%');
        if (!swapped && t > 240) { swapped = true; swap(to); }
        if (t < 520) requestAnimationFrame(run); else { screen.classList.remove('is-static'); cv.style.opacity = ''; screen.style.removeProperty('--roll'); changing = false; }
      };
      requestAnimationFrame(run);
    };
    // Skip any photo that has failed to load, so the screen never goes blank mid-cycle.
    const usable = (i) => !(pics[i].complete && pics[i].naturalWidth === 0);
    const next = () => { let to = (at + 1) % pics.length; for (let k = 0; k < pics.length && !usable(to); k++) to = (to + 1) % pics.length; change(to); };
    // Loading state: static on the screen, like a set warming up, until the first photo has arrived.
    if (!(pics[0].complete && pics[0].naturalWidth > 0) && !reduce) {
      screen.classList.add('is-static', 'is-warming'); cv.style.opacity = '.9'; ch.textContent = 'TUNING';
      screen.classList.add('show-ch');
      const warm = setInterval(snow, 70);
      const ready = () => { clearInterval(warm); screen.classList.remove('is-static', 'is-warming', 'show-ch'); cv.style.opacity = ''; ch.textContent = label(at); };
      pics[0].addEventListener('load', ready, { once: true });
      pics[0].addEventListener('error', () => setTimeout(() => { if (pics[0].naturalWidth === 0) { ready(); next(); } }, 6000), { once: true });
      setTimeout(() => { if (screen.classList.contains('is-warming')) { ready(); if (!usable(0)) next(); } }, 12000);
    }
    const sync = () => { clearInterval(timer); timer = null; if (seen && !held) timer = setInterval(next, 3600); pauseBtn.textContent = held ? 'Play' : 'Pause'; pauseBtn.setAttribute('aria-pressed', String(held)); };
    ch.textContent = label(0);
    knob.addEventListener('click', () => { next(); sync(); });
    pauseBtn.addEventListener('click', () => { held = !held; sync(); });
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => es.forEach((e) => { seen = e.isIntersecting; sync(); }), { threshold: 0.4 }).observe(tv);
    else { seen = true; sync(); }
  }

  if (reduce) return;
  root.classList.add('js'); window.__reveals = 1;
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-ready')));

  // Section reveals: images wipe open, headings rise from behind an edge. A safety net shows anything missed.
  const targets = $$('[data-wipe], [data-rise]');
  // opens two frames later, so the closed state has always been drawn first and the movement can never be skipped
  const open = (el) => requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('in'); }));
  // A frame only opens once the picture inside it has arrived, so the animation is always of the picture itself
  // and never of an empty frame. If the picture is very slow the frame opens anyway and the picture fades in.
  const reveal = (el) => {
    if (el.dataset.shown) return; el.dataset.shown = '1';
    const late = [...el.querySelectorAll('img')].filter((i) => !i.closest('.tv-screen') && !(i.complete && i.naturalWidth > 0));
    if (!late.length) { open(el); return; }
    let left = late.length, done = false;
    const go = () => { if (done) return; done = true; open(el); };
    late.forEach((i) => {
      if (i.loading === 'lazy') i.loading = 'eager';
      const one = () => { if (--left <= 0) { if (i.decode) i.decode().then(go, go); else go(); } };
      i.addEventListener('load', one, { once: true }); i.addEventListener('error', one, { once: true });
    });
    setTimeout(go, 3000);
  };
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) reveal(e.target); }), { rootMargin: '0px 0px -24px 0px' });
  // Everything animates once, on the way down, and then stays open for good. Anything that comes into view from the
  // top of the screen instead (scrolling back up, or after a jump down the page) is simply there: it is put in place
  // with its movement switched off for a moment, so nothing plays again on the way back up.
  const gone = (el) => { const r = el.getBoundingClientRect(); return r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth; };
  const place = (el) => {
    el.dataset.shown = '1'; el.classList.add('no-anim', 'in'); void el.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('no-anim')));
  };
  const settle = () => targets.forEach((el) => { if (!el.dataset.shown && el.getBoundingClientRect().top < 0) place(el); });
  let queued = false;
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; settle(); }); } }, { passive: true });
  targets.forEach((el) => io.observe(el));
  // pictures start downloading a screen and a half before they reach the line, so a frame never waits empty
  const ahead = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return;
    e.target.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; }); ahead.unobserve(e.target); }), { rootMargin: '0px 0px 150% 0px' });
  targets.forEach((el) => ahead.observe(el));
  // The safety net only opens what is on screen right now, with the observer's own line; what a jump skipped past
  // is put in place by settle() above.
  const onScreen = (el) => { const r = el.getBoundingClientRect(); return r.top < innerHeight - 24 && r.bottom > 0 && r.left < innerWidth && r.right > 0; };
  const net = () => { settle(); targets.forEach((el) => { if (onScreen(el)) reveal(el); }); };
  // Once scrolling has stopped at the foot of the page, anything still below the line opens, because there is no
  // more scrolling to lift it and nothing may stay hidden while it can be seen. Anywhere else a pause does not open
  // things early at the screen edge: they wait for the line, so the movement happens where the eye is.
  const atFoot = () => scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
  const atRest = () => { settle(); const foot = atFoot(); targets.forEach((el) => { if (onScreen(el) || (foot && !gone(el))) reveal(el); }); };
  let rest = 0; const later = () => { clearTimeout(rest); rest = setTimeout(atRest, 700); };
  addEventListener('load', () => setTimeout(atRest, 1200));
  addEventListener('scroll', later, { passive: true }); document.addEventListener('scroll', later, { passive: true, capture: true });
  // More safety nets: coming back to the tab, a restored page, a rotated phone, and a slow first few seconds.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) later(); });
  addEventListener('pageshow', later); addEventListener('resize', later);
  let checks = 0; const timer = setInterval(() => { net(); if (++checks > 8) clearInterval(timer); }, 1500);
})();
